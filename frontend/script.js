const BASE_URL = "http://127.0.0.1:5000";
const AUTH_KEY = "smart-water-token";
const POLL_MS = 2000;
const LONG_DURATION_THRESHOLD_SECONDS = 120;
const MAX_CHART_POINTS = 20;
let dashboardIntervalId = null;
let historyIntervalId = null;
let waterLevelHistory = [];
let timeLabels = [];
let waterLevelChart = null;

function safeJson(response) {
    return response.text().then((text) => {
        if (!text) {
            return {};
        }
        try {
            return JSON.parse(text);
        } catch (error) {
            throw new Error("Invalid JSON response");
        }
    });
}

function getAuthToken() {
    return localStorage.getItem(AUTH_KEY) || "";
}

function clearAuthToken() {
    localStorage.removeItem(AUTH_KEY);
}

function redirectToLogin() {
    clearAuthToken();
    if (!window.location.pathname.toLowerCase().includes("index.html")) {
        window.location.href = "index.html";
    }
}

async function apiFetch(path, options = {}) {
    const headers = new Headers(options.headers || {});
    const token = getAuthToken();

    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers,
    });

    if (response.status === 401) {
        redirectToLogin();
        throw new Error("Unauthorized");
    }

    return response;
}

function updateConnectionState(connected, elementId = "connectionStatus") {
    const status = document.getElementById(elementId);
    if (!status) {
        return;
    }

    if (connected) {
        status.textContent = "Connected";
        status.classList.remove("status-disconnected");
        status.classList.add("status-ok");
    } else {
        status.textContent = "Disconnected";
        status.classList.remove("status-ok");
        status.classList.add("status-disconnected");
    }
}

function updateWaterLevel(level) {
    const value = document.getElementById("waterLevelValue");
    const bar = document.getElementById("waterLevelBar");
    if (!value || !bar) {
        return;
    }

    const clamped = Math.max(0, Math.min(100, Number(level) || 0));
    value.textContent = String(clamped);
    bar.style.width = `${clamped}%`;
    bar.classList.remove("level-low", "level-mid", "level-high");

    if (clamped < 30) {
        bar.classList.add("level-low");
    } else if (clamped <= 70) {
        bar.classList.add("level-mid");
    } else {
        bar.classList.add("level-high");
    }
}

function updateFault(fault) {
    const faultValue = document.getElementById("faultValue");
    if (!faultValue) {
        return;
    }

    const normalized = String(fault || "NONE").toUpperCase();
    faultValue.textContent = normalized;
    faultValue.classList.remove("fault-none", "fault-warning", "fault-alert");

    if (normalized === "NONE") {
        faultValue.classList.add("fault-none");
    } else if (normalized === "NO_WATER" || normalized === "EMPTY_SUMP") {
        faultValue.classList.add("fault-warning");
    } else {
        faultValue.classList.add("fault-alert");
    }
}

function updateFaultBanner(fault, severity) {
    const banner = document.getElementById("faultAlertBanner");
    const message = document.getElementById("faultAlertMessage");
    const normalizedFault = String(fault || "NONE").toUpperCase();

    if (!banner || !message) {
        return;
    }

    if (normalizedFault === "NONE") {
        banner.style.display = "none";
        return;
    }

    banner.style.display = "block";
    message.textContent = `Severity: ${String(severity || "WARNING").toUpperCase()} | Fault: ${normalizedFault}`;
}

function updateModeAndMotorControls(mode, motorState) {
    const modeValue = document.getElementById("modeValue");
    const motorValue = document.getElementById("motorStateValue");
    const toggleBtn = document.getElementById("modeToggleBtn");
    const onBtn = document.getElementById("motorOnBtn");
    const offBtn = document.getElementById("motorOffBtn");
    const hint = document.getElementById("motorControlHint");

    const normalizedMode = String(mode || "AUTO").toUpperCase();
    const isAuto = normalizedMode === "AUTO";
    const isMotorOn = Number(motorState) === 1 || String(motorState).toUpperCase() === "ON";

    if (modeValue) {
        modeValue.textContent = normalizedMode;
    }
    if (motorValue) {
        motorValue.textContent = isMotorOn ? "ON" : "OFF";
    }
    if (toggleBtn) {
        toggleBtn.textContent = isAuto ? "Switch to MANUAL" : "Switch to AUTO";
    }
    if (onBtn) {
        onBtn.disabled = isAuto;
    }
    if (offBtn) {
        offBtn.disabled = isAuto;
    }
    if (hint) {
        hint.textContent = isAuto
            ? "Motor controls are disabled in AUTO mode."
            : "Motor controls are active in MANUAL mode.";
    }
}

function updateTimestamp(value) {
    const timestamp = document.getElementById("timestampValue");
    if (timestamp) {
        timestamp.textContent = value || "--";
    }
}

function formatTimeLabel(timestamp) {
    if (typeof timestamp === "string" && timestamp.includes(" ")) {
        const parts = timestamp.split(" ");
        return parts[parts.length - 1] || timestamp;
    }

    const now = new Date();
    return now.toLocaleTimeString("en-GB", { hour12: false });
}

function initWaterLevelChart() {
    const chartCanvas = document.getElementById("waterLevelChart");
    if (!chartCanvas || typeof Chart === "undefined") {
        return;
    }

    const context = chartCanvas.getContext("2d");
    if (!context) {
        return;
    }

    waterLevelChart = new Chart(context, {
        type: "line",
        data: {
            labels: timeLabels,
            datasets: [
                {
                    label: "Water Level (%)",
                    data: waterLevelHistory,
                    borderColor: "#2563eb",
                    backgroundColor: "rgba(37, 99, 235, 0.15)",
                    fill: true,
                    tension: 0.25,
                    pointRadius: 2,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                y: {
                    min: 0,
                    max: 100,
                    title: {
                        display: true,
                        text: "Water Level (%)",
                    },
                },
                x: {
                    title: {
                        display: true,
                        text: "Time (HH:MM:SS)",
                    },
                },
            },
        },
    });
}

function updateWaterLevelChart(level, timestamp) {
    if (waterLevelChart === null) {
        return;
    }

    const levelNumber = Number(level);
    if (Number.isNaN(levelNumber)) {
        return;
    }

    const clampedLevel = Math.max(0, Math.min(100, levelNumber));
    waterLevelHistory.push(clampedLevel);
    timeLabels.push(formatTimeLabel(timestamp));

    if (waterLevelHistory.length > MAX_CHART_POINTS) {
        waterLevelHistory.shift();
    }
    if (timeLabels.length > MAX_CHART_POINTS) {
        timeLabels.shift();
    }

    waterLevelChart.data.labels = timeLabels;
    waterLevelChart.data.datasets[0].data = waterLevelHistory;
    waterLevelChart.update();
}

async function fetchStatus() {
    try {
        const response = await apiFetch("/api/status");
        if (!response.ok) {
            throw new Error(`Status request failed (${response.status})`);
        }
        const data = await safeJson(response);
        updateConnectionState(true, "connectionStatus");
        updateWaterLevel(data.water_level);
        updateModeAndMotorControls(data.mode, data.motor);
        updateFault(data.fault);
        updateFaultBanner(data.fault, data.fault_severity);
        updateTimestamp(data.timestamp);
        updateWaterLevelChart(data.water_level, data.timestamp);
    } catch (error) {
        updateConnectionState(false, "connectionStatus");
        updateTimestamp("Backend unavailable");
        console.error(error);
    }
}

async function setMode(mode) {
    try {
        const response = await apiFetch("/api/mode", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode }),
        });
        if (!response.ok) {
            throw new Error(`Mode update failed (${response.status})`);
        }
        await safeJson(response);
        await fetchStatus();
    } catch (error) {
        updateConnectionState(false, "connectionStatus");
        console.error(error);
    }
}

async function controlMotor(state) {
    try {
        const response = await apiFetch("/api/motor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ motor: state }),
        });
        if (!response.ok) {
            throw new Error(`Motor control failed (${response.status})`);
        }
        await safeJson(response);
        await fetchStatus();
    } catch (error) {
        updateConnectionState(false, "connectionStatus");
        console.error(error);
    }
}

function setupDashboard() {
    if (!window.location.pathname.toLowerCase().includes("dashboard")) {
        return;
    }

    if (!getAuthToken()) {
        redirectToLogin();
        return;
    }

    initWaterLevelChart();

    const modeToggleBtn = document.getElementById("modeToggleBtn");
    const motorOnBtn = document.getElementById("motorOnBtn");
    const motorOffBtn = document.getElementById("motorOffBtn");
    const viewHistoryBtn = document.getElementById("viewHistoryBtn");
    const logoutBtn = document.getElementById("logoutBtn");

    if (modeToggleBtn) {
        modeToggleBtn.addEventListener("click", () => {
            const currentMode = document.getElementById("modeValue")?.textContent || "AUTO";
            const targetMode = currentMode.toUpperCase() === "AUTO" ? "MANUAL" : "AUTO";
            setMode(targetMode);
        });
    }

    if (motorOnBtn) {
        motorOnBtn.addEventListener("click", () => controlMotor("ON"));
    }
    if (motorOffBtn) {
        motorOffBtn.addEventListener("click", () => controlMotor("OFF"));
    }
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            redirectToLogin();
        });
    }
    if (viewHistoryBtn) {
        viewHistoryBtn.addEventListener("click", () => {
            window.location.href = "history.html";
        });
    }

    fetchStatus();
    if (dashboardIntervalId === null) {
        dashboardIntervalId = setInterval(fetchStatus, POLL_MS);
    }
}

function setupLogin() {
    const form = document.getElementById("loginForm");
    if (!form) {
        return;
    }

    const errorMessage = document.getElementById("loginError");

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const username = document.getElementById("username")?.value || "";
        const password = document.getElementById("password")?.value || "";

        try {
            const response = await fetch(`${BASE_URL}/api/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            if (!response.ok) {
                throw new Error("Invalid username or password.");
            }

            const data = await safeJson(response);
            localStorage.setItem(AUTH_KEY, data.token || "");
            window.location.href = "dashboard.html";
            return;
        } catch (error) {
            if (errorMessage) {
                errorMessage.textContent = "Invalid username or password.";
            }
        }
    });
}

function renderLogsTable(logs) {
    const tableBody = document.getElementById("logsTableBody");
    const emptyState = document.getElementById("logsEmptyState");
    const summary = document.getElementById("historySummary");
    const historyError = document.getElementById("historyError");
    if (!tableBody || !emptyState || !summary) {
        return;
    }

    tableBody.innerHTML = "";
    if (historyError) {
        historyError.textContent = "";
    }

    if (!Array.isArray(logs) || logs.length === 0) {
        emptyState.textContent = "No records";
        summary.textContent = "Total runs: 0 | Total duration: 0 sec | Total power: 0.0";
        return;
    }

    emptyState.textContent = "";
    let totalDuration = 0;
    let totalPower = 0;

    logs.forEach((log) => {
        const tr = document.createElement("tr");
        const duration = Number(log.duration) || 0;
        const power = Number(log.power) || 0;
        const fault = String(log.fault || "NONE").toUpperCase();

        totalDuration += duration;
        totalPower += power;

        const durationClass = duration > LONG_DURATION_THRESHOLD_SECONDS ? "duration-long" : "";
        const faultClass = fault === "NONE" ? "fault-cell-none" : "fault-cell-alert";

        tr.innerHTML = `
            <td>${log.date || "--"}</td>
            <td>${log.start_time || "--"}</td>
            <td>${log.end_time || "--"}</td>
            <td class="${durationClass}">${duration}</td>
            <td>${power.toFixed(2)}</td>
            <td class="${faultClass}">${fault}</td>
        `;
        tableBody.appendChild(tr);
    });

    summary.textContent = `Total runs: ${logs.length} | Total duration: ${totalDuration} sec | Total power: ${totalPower.toFixed(2)}`;
}

async function fetchLogs() {
    const historyError = document.getElementById("historyError");
    const emptyState = document.getElementById("logsEmptyState");

    try {
        const response = await apiFetch("/api/logs");
        if (!response.ok) {
            throw new Error(`Logs request failed (${response.status})`);
        }
        const logs = await safeJson(response);
        updateConnectionState(true, "historyConnectionStatus");
        renderLogsTable(logs);
    } catch (error) {
        updateConnectionState(false, "historyConnectionStatus");
        if (historyError) {
            historyError.textContent = "Failed to load logs.";
        }
        if (emptyState) {
            emptyState.textContent = "No records";
        }
        console.error(error);
    }
}

function setupHistory() {
    if (!window.location.pathname.toLowerCase().includes("history")) {
        return;
    }

    const tableBody = document.getElementById("logsTableBody");
    if (!tableBody) {
        return;
    }

    if (!getAuthToken()) {
        redirectToLogin();
        return;
    }

    const backBtn = document.getElementById("backToDashboardBtn");
    if (backBtn) {
        backBtn.addEventListener("click", () => {
            window.location.href = "dashboard.html";
        });
    }

    fetchLogs();
    if (historyIntervalId === null) {
        historyIntervalId = setInterval(fetchLogs, POLL_MS);
    }
}

window.setMode = setMode;
window.controlMotor = controlMotor;
window.fetchStatus = fetchStatus;
window.fetchLogs = fetchLogs;

document.addEventListener("DOMContentLoaded", () => {
    const path = window.location.pathname.toLowerCase();

    if (path.includes("dashboard")) {
        setupDashboard();
        return;
    }

    if (path.includes("history")) {
        setupHistory();
        return;
    }

    /* Login page should only handle authentication form interactions. */
    setupLogin();
});
