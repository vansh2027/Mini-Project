require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const passport = require('passport');
const session = require('express-session');
const axios = require('axios');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;

const app = express();

// Serve static files from the public directory
app.use(express.static('public'));

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                "'unsafe-eval'",
                "cdn.jsdelivr.net",
                "cdnjs.cloudflare.com",
                "apis.google.com",
                "www.gstatic.com",
                "*.googleapis.com"
            ],
            styleSrc: [
                "'self'",
                "'unsafe-inline'",
                "cdn.jsdelivr.net",
                "cdnjs.cloudflare.com",
                "fonts.googleapis.com"
            ],
            imgSrc: [
                "'self'",
                "openweathermap.org",
                "*.openweathermap.org",
                "data:",
                "https:",
                "*.googleapis.com",
                "*.gstatic.com"
            ],
            connectSrc: [
                "'self'",
                "api.openweathermap.org",
                "newsapi.org",
                "apis.google.com",
                "*.googleapis.com"
            ],
            fontSrc: [
                "'self'",
                "cdnjs.cloudflare.com",
                "fonts.gstatic.com"
            ],
            frameSrc: [
                "'self'",
                "accounts.google.com",
                "github.com"
            ],
            objectSrc: ["'none'"],
            mediaSrc: ["'none'"]
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false
}));
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Session configuration
app.use(session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// User model
const User = mongoose.model('User', new mongoose.Schema({
    googleId: String,
    githubId: String,
    email: String,
    name: String,
    avatar: String
}));

// Passport serialization
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

// Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ googleId: profile.id });
        if (!user) {
            user = await User.create({
                googleId: profile.id,
                email: profile.emails[0].value,
                name: profile.displayName,
                avatar: profile.photos[0].value
            });
        }
        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));

// GitHub OAuth Strategy
passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: 'http://localhost:3000/auth/github/callback'
}, async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ githubId: profile.id });
        if (!user) {
            user = await User.create({
                githubId: profile.id,
                email: profile.emails[0].value,
                name: profile.displayName,
                avatar: profile.photos[0].value
            });
        }
        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));

// Auth middleware
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Not authenticated' });
};

// OAuth routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { 
    failureRedirect: '/login'
}), (req, res) => {
    req.session.user = req.user;
    res.redirect('/');
});

app.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));
app.get('/auth/github/callback', passport.authenticate('github', {
    failureRedirect: '/login'
}), (req, res) => {
    req.session.user = req.user;
    res.redirect('/');
});

// Auth status route
app.get('/auth/status', (req, res) => {
    res.json({ 
        authenticated: req.isAuthenticated(),
        user: req.user 
    });
});

// Logout route
app.post('/auth/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error('Logout error:', err);
            res.status(500).send('Failed to logout');
        } else {
            req.session.destroy((err) => {
                if (err) {
                    console.error('Session destruction error:', err);
                    res.status(500).send('Failed to logout');
                } else {
                    res.status(200).send('Logged out successfully');
                }
            });
        }
    });
});

// External API routes
app.get('/api/weather/:city', isAuthenticated, async (req, res) => {
    try {
        const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather`, {
            params: {
                q: req.params.city,
                appid: process.env.WEATHER_API_KEY,
                units: 'metric'
            }
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch weather data' });
    }
});

app.get('/api/news/:category', isAuthenticated, async (req, res) => {
    try {
        const response = await axios.get(`https://newsapi.org/v2/top-headlines`, {
            params: {
                country: 'us',
                category: req.params.category,
                apiKey: process.env.NEWS_API_KEY
            }
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch news data' });
    }
});

// Add a catch-all route to serve index.html for client-side routing
app.get('/', (req, res) => {
    res.sendFile('index.html', { root: 'public' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something broke!' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`OAuth callback URLs:`);
    console.log(`Google: ${process.env.GOOGLE_CALLBACK_URL}`);
    console.log(`GitHub: ${process.env.GITHUB_CALLBACK_URL}`);
}); 