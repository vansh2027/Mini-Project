// DOM Elements
const authSection = document.getElementById('authSection');
const mainContent = document.getElementById('mainContent');
const weatherForm = document.getElementById('weatherForm');
const cityInput = document.getElementById('cityInput');
const weatherResults = document.getElementById('weatherResults');
const weatherCity = document.getElementById('weatherCity');
const weatherIcon = document.getElementById('weatherIcon');
const weatherTemp = document.getElementById('weatherTemp');
const weatherDesc = document.getElementById('weatherDesc');
const weatherWind = document.getElementById('weatherWind');
const weatherHumidity = document.getElementById('weatherHumidity');
const weatherPressure = document.getElementById('weatherPressure');
const weatherVisibility = document.getElementById('weatherVisibility');
const newsResults = document.getElementById('newsResults');
const categoryButtons = document.querySelector('.category-buttons');
const logoutBtn = document.getElementById('logoutBtn');

// Toast notification
const toast = new bootstrap.Toast(document.querySelector('.toast'));
const toastBody = document.querySelector('.toast-body');

// Add event listeners for OAuth buttons
document.getElementById('googleLogin').addEventListener('click', () => {
    window.location.href = '/auth/google';
});

document.getElementById('githubLogin').addEventListener('click', () => {
    window.location.href = '/auth/github';
});

// Add logout functionality
logoutBtn.addEventListener('click', async () => {
    try {
        const response = await fetch('/auth/logout', { method: 'POST' });
        if (response.ok) {
            showToast('success', 'Logged out successfully');
            setTimeout(() => {
                showAuthSection();
                weatherResults.style.display = 'none';
                newsResults.innerHTML = '';
            }, 1000);
        } else {
            throw new Error('Logout failed');
        }
    } catch (error) {
        console.error('Logout error:', error);
        showToast('error', 'Failed to logout. Please try again.');
    }
});

// Check authentication status on page load
checkAuthStatus();

async function checkAuthStatus() {
    try {
        const response = await fetch('/auth/status');
        const data = await response.json();
        
        if (data.authenticated) {
            showMainContent();
            // Load weather data for Rajpipla immediately
            try {
                const weatherResponse = await fetch('/api/weather/Rajkot');
                if (weatherResponse.ok) {
                    const weatherData = await weatherResponse.json();
                    displayWeatherInfo(weatherData);
                }
            } catch (error) {
                console.error('Weather error:', error);
                showToast('error', 'Failed to load weather data');
            }

            // Load news data immediately
            try {
                const newsResponse = await fetch('/api/news/general');
                if (newsResponse.ok) {
                    const newsData = await newsResponse.json();
                    displayNewsData(newsData);
                }
            } catch (error) {
                console.error('News error:', error);
                showToast('error', 'Failed to load news data');
            }
        } else {
            showAuthSection();
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        showAuthSection();
        showToast('error', 'Failed to check authentication status');
    }
}

function showMainContent() {
    authSection.style.display = 'none';
    mainContent.style.display = 'block';
    logoutBtn.style.display = 'block';
    weatherResults.style.display = 'block';  // Show weather container
    mainContent.style.opacity = '0';
    setTimeout(() => {
        mainContent.style.transition = 'opacity 0.5s ease';
        mainContent.style.opacity = '1';
    }, 100);
}

function showAuthSection() {
    authSection.style.display = 'block';
    mainContent.style.display = 'none';
    logoutBtn.style.display = 'none';
}

// Weather functionality
weatherForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const city = cityInput.value.trim();
    if (!city) return;

    try {
        setLoading(weatherForm.querySelector('button'), true);
        const response = await fetch(`/api/weather/${encodeURIComponent(city)}`);
        if (!response.ok) {
            throw new Error(await response.text());
        }
        const data = await response.json();
        displayWeatherInfo(data);
        cityInput.value = '';
    } catch (error) {
        showToast('error', 'Failed to fetch weather data. Please try again.');
        console.error('Weather error:', error);
    } finally {
        setLoading(weatherForm.querySelector('button'), false);
    }
});

function displayWeatherInfo(data) {
    weatherResults.style.display = 'block';
    const iconUrl = `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;
    
    weatherCity.textContent = `${data.name}, ${data.sys.country}`;
    weatherIcon.src = iconUrl;
    weatherIcon.alt = data.weather[0].description;
    weatherTemp.textContent = `${Math.round(data.main.temp)}°C`;
    weatherDesc.textContent = data.weather[0].description;
    weatherWind.textContent = ` ${data.wind.speed} m/s`;
    weatherHumidity.textContent = ` ${data.main.humidity}%`;
    weatherPressure.textContent = ` ${data.main.pressure} hPa`;
    weatherVisibility.textContent = ` ${(data.visibility / 1000).toFixed(1)} km`;
}

// News functionality
categoryButtons.addEventListener('click', async (e) => {
    if (e.target.matches('button')) {
        const buttons = categoryButtons.querySelectorAll('button');
        buttons.forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        
        const category = e.target.dataset.category;
        try {
            setLoading(e.target, true);
            const response = await fetch(`/api/news/${category}`);
            if (!response.ok) {
                throw new Error(await response.text());
            }
            const data = await response.json();
            displayNewsData(data);
        } catch (error) {
            showToast('error', 'Failed to fetch news data. Please try again.');
            console.error('News error:', error);
        } finally {
            setLoading(e.target, false);
        }
    }
});

function displayNewsData(data) {
    newsResults.innerHTML = '';
    if (!data.articles || data.articles.length === 0) {
        newsResults.innerHTML = '<p class="text-center">No news articles found.</p>';
        return;
    }

    data.articles.forEach(article => {
        if (!article.title || !article.description) return;
        
        const newsCard = document.createElement('div');
        newsCard.className = 'news-item';
        newsCard.innerHTML = `
            <h5 class="card-title">${article.title}</h5>
            <p class="card-text">${article.description}</p>
            <div class="d-flex justify-content-between align-items-center">
                <small class="text-muted">${new Date(article.publishedAt).toLocaleDateString()}</small>
                <a href="${article.url}" target="_blank" class="btn btn-sm btn-primary">Read More</a>
            </div>
        `;
        newsCard.addEventListener('click', (e) => {
            if (!e.target.matches('a')) {
                window.open(article.url, '_blank');
            }
        });
        newsResults.appendChild(newsCard);
    });
}

// Utility functions
function showToast(type, message) {
    const toastEl = document.querySelector('.toast');
    toastEl.className = `toast ${type === 'error' ? 'bg-danger' : 'bg-success'} text-white`;
    toastBody.textContent = message;
    toast.show();
}

// Add loading states
function setLoading(element, isLoading) {
    if (isLoading) {
        element.classList.add('disabled');
        const originalText = element.innerHTML;
        if (!element.dataset.originalText) {
            element.dataset.originalText = originalText;
        }
        element.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Loading...';
    } else {
        element.classList.remove('disabled');
        element.innerHTML = element.dataset.originalText || element.innerHTML;
    }
}

// Save original button text
document.querySelectorAll('button').forEach(button => {
    button.dataset.originalText = button.innerHTML;
}); 