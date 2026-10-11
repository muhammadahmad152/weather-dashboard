const API_KEY = "c75362a37adc79a6f83da61a8eadfa9b";

let currentUnit = "metric";
let currentCity = "Karachi";
let currentTimezoneOffset = 0;

let hourlyChartInstance = null;
let liveClockInterval = null;

const cityInput = document.getElementById("city-search-input");
const searchBtn = document.getElementById("search-btn");
const locationBtn = document.getElementById("location-btn");
const errorMessage = document.getElementById("error-message");

const unitCelsius = document.getElementById("unit-celsius");
const unitFahrenheit = document.getElementById("unit-fahrenheit");

const cityNameEl = document.getElementById("city-name");
const dateTextEl = document.getElementById("date-text");
const liveTimeEl = document.getElementById("live-time");

const tempEl = document.getElementById("temp");
const feelsLikeTempEl = document.getElementById("feels-like-temp");
const conditionEl = document.getElementById("condition");
const mainIconEl = document.getElementById("main-icon");

const highTempEl = document.getElementById("high-temp");
const lowTempEl = document.getElementById("low-temp");

const humidityEl = document.getElementById("humidity");
const windEl = document.getElementById("wind");
const pressureEl = document.getElementById("pressure");
const visibilityEl = document.getElementById("visibility");
const uvIndexEl = document.getElementById("uv-index");
const aqiEl = document.getElementById("aqi");
const sunriseEl = document.getElementById("sunrise");
const sunsetEl = document.getElementById("sunset");

const forecastContainer = document.getElementById("forecast-container");

searchBtn.addEventListener("click", () => {
    const city = cityInput.value.trim();

    if (!city) {
        showError("Please enter a city name.");
        return;
    }

    currentCity = city;
    fetchWeatherByCity(city);
});

cityInput.addEventListener("keyup", (event) => {
    if (event.key === "Enter") {
        searchBtn.click();
    }
});

locationBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
        showError("Geolocation is not supported by your browser.");
        return;
    }

    hideError();

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;

            fetchWeatherByCoords(latitude, longitude);
        },
        () => {
            showError("Location access denied. Please allow location access.");
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
});

unitCelsius.addEventListener("change", () => {
    if (!unitCelsius.checked) return;

    currentUnit = "metric";
    fetchWeatherByCity(currentCity);
});

unitFahrenheit.addEventListener("change", () => {
    if (!unitFahrenheit.checked) return;

    currentUnit = "imperial";
    fetchWeatherByCity(currentCity);
});

window.addEventListener("DOMContentLoaded", () => {
    if (!API_KEY) {
        showError("Please add your OpenWeather API key in script.js.");
        return;
    }

    fetchWeatherByCity(currentCity);
    startLiveClock();
});

async function fetchWeatherByCity(city) {
    hideError();

    if (!API_KEY) {
        showError("OpenWeather API key is missing.");
        return;
    }

    try {
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=${currentUnit}&appid=${API_KEY}`;

        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error("City not found. Please try another city.");
            }
            if (response.status === 401) {
                throw new Error("Invalid OpenWeather API key.");
            }
            throw new Error("Unable to fetch weather data.");
        }

        const data = await response.json();

        currentCity = data.name;
        cityInput.value = data.name;

        updateCurrentWeather(data);

        await Promise.allSettled([
            fetchForecast(data.coord.lat, data.coord.lon),
            fetchAQI(data.coord.lat, data.coord.lon)
        ]);

    } catch (error) {
        showError(error.message || "Something went wrong.");
    }
}

async function fetchWeatherByCoords(latitude, longitude) {
    hideError();

    if (!API_KEY) {
        showError("OpenWeather API key is missing.");
        return;
    }

    try {
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=${currentUnit}&appid=${API_KEY}`;

        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error("Invalid OpenWeather API key.");
            }
            throw new Error("Unable to fetch location weather.");
        }

        const data = await response.json();

        currentCity = data.name;
        cityInput.value = data.name;

        updateCurrentWeather(data);

        await Promise.allSettled([
            fetchForecast(latitude, longitude),
            fetchAQI(latitude, longitude)
        ]);

    } catch (error) {
        showError(error.message || "Unable to fetch location weather.");
    }
}

function updateCurrentWeather(data) {
    if (!data || !data.weather || !data.weather.length) {
        return;
    }

    currentTimezoneOffset = data.timezone || 0;

    const weather = data.weather[0];

    const weatherCode = getCorrectDayNightIcon(
        weather.icon,
        data.dt,
        data.sys.sunrise,
        data.sys.sunset
    );

    const unitSymbol = currentUnit === "metric" ? "°C" : "°F";
    const speedSymbol = currentUnit === "metric" ? "km/h" : "mph";

    cityNameEl.textContent = `${data.name}, ${data.sys.country}`;
    tempEl.textContent = `${Math.round(data.main.temp)}${unitSymbol}`;
    feelsLikeTempEl.textContent = `${Math.round(data.main.feels_like)}${unitSymbol}`;
    conditionEl.textContent = weather.description;
    highTempEl.textContent = `${Math.round(data.main.temp_max)}${unitSymbol}`;
    lowTempEl.textContent = `${Math.round(data.main.temp_min)}${unitSymbol}`;

    humidityEl.textContent = `${data.main.humidity}%`;
    windEl.textContent = `${Math.round(data.wind.speed)} ${speedSymbol}`;
    pressureEl.textContent = `${data.main.pressure} hPa`;
    visibilityEl.textContent = `${(data.visibility / 1000).toFixed(1)} km`;

    sunriseEl.textContent = formatTime(data.sys.sunrise, data.timezone);
    sunsetEl.textContent = formatTime(data.sys.sunset, data.timezone);

    setMainWeatherIcon(weatherCode);
    updatePageAtmosphere(weatherCode);

    const localDate = new Date((data.dt + data.timezone) * 1000);
    dateTextEl.textContent = localDate.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: "UTC"
    });

    uvIndexEl.textContent = "N/A";
}

function getCorrectDayNightIcon(icon, currentTime, sunrise, sunset) {
    if (!icon) return "03d";

    const weatherType = icon.substring(0, 2);
    const isNight = currentTime < sunrise || currentTime >= sunset;

    return `${weatherType}${isNight ? "n" : "d"}`;
}

function setMainWeatherIcon(code) {
    const iconMap = {
        "01d": { icon: "bi-sun-fill", color: "#FFD166", glow: "rgba(255, 209, 102, 0.8)" },
        "01n": { icon: "bi-moon-stars-fill", color: "#B8CCFF", glow: "rgba(120, 160, 255, 0.8)" },
        "02d": { icon: "bi-cloud-sun-fill", color: "#7DE7FF", glow: "rgba(80, 220, 255, 0.7)" },
        "02n": { icon: "bi-cloud-moon-fill", color: "#A5BAE8", glow: "rgba(100, 140, 220, 0.7)" },
        "03d": { icon: "bi-cloud-fill", color: "#B9CBD8", glow: "rgba(160, 190, 210, 0.5)" },
        "03n": { icon: "bi-cloud-fill", color: "#71839D", glow: "rgba(90, 110, 145, 0.6)" },
        "04d": { icon: "bi-clouds-fill", color: "#AFC7D5", glow: "rgba(130, 180, 205, 0.6)" },
        "04n": { icon: "bi-clouds-fill", color: "#64758F", glow: "rgba(80, 100, 140, 0.6)" },
        "09d": { icon: "bi-cloud-drizzle-fill", color: "#61D9FF", glow: "rgba(50, 210, 255, 0.7)" },
        "09n": { icon: "bi-cloud-drizzle-fill", color: "#719ED0", glow: "rgba(80, 140, 210, 0.7)" },
        "10d": { icon: "bi-cloud-rain-heavy-fill", color: "#54D9FF", glow: "rgba(50, 210, 255, 0.7)" },
        "10n": { icon: "bi-cloud-rain-heavy-fill", color: "#719BD0", glow: "rgba(70, 130, 210, 0.7)" },
        "11d": { icon: "bi-cloud-lightning-fill", color: "#C19CFF", glow: "rgba(150, 100, 255, 0.8)" },
        "11n": { icon: "bi-cloud-lightning-fill", color: "#9679D8", glow: "rgba(110, 80, 210, 0.8)" },
        "13d": { icon: "bi-snow", color: "#BDEEFF", glow: "rgba(120, 220, 255, 0.7)" },
        "13n": { icon: "bi-snow", color: "#9DC9E8", glow: "rgba(90, 170, 230, 0.7)" },
        "50d": { icon: "bi-cloud-haze-fill", color: "#B7C6CF", glow: "rgba(160, 190, 200, 0.5)" },
        "50n": { icon: "bi-cloud-haze-fill", color: "#74818E", glow: "rgba(100, 120, 140, 0.6)" }
    };

    const weather = iconMap[code] || iconMap["03d"];

    mainIconEl.className = `bi ${weather.icon} display-1 mb-2`;
    mainIconEl.style.color = weather.color;
    mainIconEl.style.textShadow = `0 0 10px ${weather.glow}, 0 0 25px ${weather.glow}, 0 0 55px ${weather.glow}`;
    mainIconEl.dataset.weather = code;
    mainIconEl.setAttribute("aria-label", `Current weather icon: ${code}`);
}

function updatePageAtmosphere(code) {
    document.body.dataset.weather = code;

    const isNight = typeof code === "string" && code.endsWith("n");

    document.body.classList.toggle("night-mode", isNight);
    document.body.classList.toggle("day-mode", !isNight);
}

async function fetchForecast(latitude, longitude) {
    try {
        const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&units=${currentUnit}&appid=${API_KEY}`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Forecast unavailable.");
        }

        const data = await response.json();

        updateHourlyChart(data.list);
        updateForecastUI(data.list);

    } catch (error) {
        console.error("Forecast Error:", error);

        if (forecastContainer) {
            forecastContainer.innerHTML = `
                <div class="col-12">
                    <div class="text-center text-white-50 py-3">
                        Forecast unavailable
                    </div>
                </div>
            `;
        }
    }
}

async function fetchAQI(latitude, longitude) {
    try {
        const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${latitude}&lon=${longitude}&appid=${API_KEY}`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("AQI unavailable.");
        }

        const data = await response.json();
        const aqi = data.list?.[0]?.main?.aqi;

        const levels = ["Good", "Fair", "Moderate", "Poor", "Very Poor"];

        aqiEl.textContent = levels[aqi - 1] || "--";
        aqiEl.dataset.aqi = aqi || "";

    } catch (error) {
        console.error("AQI Error:", error);
        aqiEl.textContent = "N/A";
    }
}

function updateHourlyChart(forecastList) {
    const canvas = document.getElementById("hourly-chart");

    if (!canvas || typeof Chart === "undefined") {
        return;
    }

    const ctx = canvas.getContext("2d");
    const hourlyData = forecastList.slice(0, 8);

    const labels = hourlyData.map(item => {
        return new Date(item.dt * 1000).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit"
        });
    });

    const temps = hourlyData.map(item => Math.round(item.main.temp));
    const unitSymbol = currentUnit === "metric" ? "°C" : "°F";

    if (hourlyChartInstance) {
        hourlyChartInstance.destroy();
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, 220);
    gradient.addColorStop(0, "rgba(53, 231, 255, 0.30)");
    gradient.addColorStop(0.5, "rgba(53, 231, 255, 0.10)");
    gradient.addColorStop(1, "rgba(53, 231, 255, 0)");

    hourlyChartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: `Temperature (${unitSymbol})`,
                data: temps,
                borderColor: "#35e7ff",
                backgroundColor: gradient,
                fill: true,
                tension: 0.42,
                borderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 6,
                pointBackgroundColor: "#35e7ff",
                pointBorderColor: "#061018",
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: "index"
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: "#07111D",
                    borderColor: "rgba(53, 231, 255, .35)",
                    borderWidth: 1,
                    titleColor: "#35e7ff",
                    bodyColor: "#ffffff",
                    padding: 12,
                    displayColors: false
                }
            },
            scales: {
                x: {
                    ticks: { color: "#718096", font: { size: 10 } },
                    grid: { display: false },
                    border: { display: false }
                },
                y: {
                    ticks: { color: "#718096", font: { size: 10 } },
                    grid: { color: "rgba(255,255,255,.055)" },
                    border: { display: false }
                }
            }
        }
    });
}


function updateForecastUI(list) {
    if (!forecastContainer) return;

    forecastContainer.innerHTML = "";

    const dailyForecasts = list.filter(item => {
        return item.dt_txt && item.dt_txt.includes("12:00:00");
    });

    const unitSymbol = currentUnit === "metric" ? "°C" : "°F";

    dailyForecasts.slice(0, 5).forEach(item => {
        const weather = item.weather?.[0];
        if (!weather) return;

        const correctedIcon = getForecastCorrectDayNightIcon(weather.icon, item.dt);
        const dayName = new Date(item.dt * 1000).toLocaleDateString("en-US", { weekday: "short" });
        const icon = getWeatherIcon(correctedIcon);
        const color = getForecastIconColor(correctedIcon);

        const card = document.createElement("div");
        card.className = "col";

        card.innerHTML = `
            <div class="bg-dark bg-opacity-50 p-3 rounded-4 border border-secondary border-opacity-25 text-center forecast-card">
                <p class="small text-white-50 mb-1">${dayName}</p>
                <i class="bi ${icon} fs-3 ${color} my-1 d-block" aria-hidden="true"></i>
                <h6 class="fw-bold mb-0">${Math.round(item.main.temp)}${unitSymbol}</h6>
            </div>
        `;

        forecastContainer.appendChild(card);
    });
}

function getForecastCorrectDayNightIcon(icon, timestamp) {
    if (!icon) return "03d";
    const weatherType = icon.substring(0, 2);

    if (icon.endsWith("d") || icon.endsWith("n")) {
        return icon;
    }

    return `${weatherType}d`;
}

function getWeatherIcon(code) {
    const map = {
        "01d": "bi-sun-fill",
        "01n": "bi-moon-stars-fill",
        "02d": "bi-cloud-sun-fill",
        "02n": "bi-cloud-moon-fill",
        "03d": "bi-cloud-fill",
        "03n": "bi-cloud-fill",
        "04d": "bi-clouds-fill",
        "04n": "bi-clouds-fill",
        "09d": "bi-cloud-drizzle-fill",
        "09n": "bi-cloud-drizzle-fill",
        "10d": "bi-cloud-rain-heavy-fill",
        "10n": "bi-cloud-rain-heavy-fill",
        "11d": "bi-cloud-lightning-fill",
        "11n": "bi-cloud-lightning-fill",
        "13d": "bi-snow",
        "13n": "bi-snow",
        "50d": "bi-cloud-haze-fill",
        "50n": "bi-cloud-haze-fill"
    };

    return map[code] || "bi-cloud-fill";
}

function getForecastIconColor(code) {
    if (code === "01d") return "text-warning";
    if (code === "01n") return "text-info";
    if (code === "02d" || code === "02n") return "text-info";
    if (code.startsWith("09") || code.startsWith("10")) return "text-info";
    if (code.startsWith("11")) return "text-primary";
    if (code.startsWith("13")) return "text-info";
    if (code.startsWith("50")) return "text-white-50";

    return "text-white-50";
}

function updateLiveClock() {
    if (!liveTimeEl) return;

    const now = new Date();
    const browserOffset = -now.getTimezoneOffset() * 60;

    const cityTime = new Date(
        now.getTime() + (currentTimezoneOffset - browserOffset) * 1000
    );

    liveTimeEl.textContent = cityTime.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
    });
}

function startLiveClock() {
    updateLiveClock();

    if (liveClockInterval) {
        clearInterval(liveClockInterval);
    }

    liveClockInterval = setInterval(updateLiveClock, 1000);
}

function formatTime(timestamp, timezoneOffset) {
    const date = new Date((timestamp + timezoneOffset) * 1000);

    return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC"
    });
}

function showError(message) {
    if (!errorMessage) return;

    errorMessage.textContent = message;
    errorMessage.classList.remove("d-none");
}

function hideError() {
    if (!errorMessage) return;

    errorMessage.classList.add("d-none");
}