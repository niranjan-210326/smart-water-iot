const BASE_URL = "http://127.0.0.1:5000";
const AUTH_KEY = "smart-water-auth";
const POLL_MS = 2000;
const LONG_DURATION_THRESHOLD_SECONDS = 120;
let dashboardIntervalId = null;
let historyIntervalId = null;

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

async function fetchStatus() {
    try {
        const response = await fetch(`${BASE_URL}/status`);
        if (!response.ok) {
            throw new Error(`Status request failed (${response.status})`);
        }
        const data = await safeJson(response);
        updateConnectionState(true, "connectionStatus");
        updateWaterLevel(data.water_level);
        updateModeAndMotorControls(data.mode, data.motor);
        updateFault(data.fault);
        updateTimestamp(data.timestamp);
    } catch (error) {
        updateConnectionState(false, "connectionStatus");
        updateTimestamp("Backend unavailable");
        console.error(error);
    }
}

async function setMode(mode) {
    try {
        const response = await fetch(`${BASE_URL}/mode`, {
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
        const response = await fetch(`${BASE_URL}/motor/control`, {
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

    if (sessionStorage.getItem(AUTH_KEY) !== "true") {
        window.location.href = "index.html";
        return;
    }

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
            sessionStorage.removeItem(AUTH_KEY);
            window.location.href = "index.html";
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
    const HARD_USER = "admin";
    const HARD_PASS = "admin123";

    form.addEventListener("submit", (event) => {
        event.preventDefault();

        const username = document.getElementById("username")?.value || "";
        const password = document.getElementById("password")?.value || "";

        if (username === HARD_USER && password === HARD_PASS) {
            sessionStorage.setItem(AUTH_KEY, "true");
            window.location.href = "dashboard.html";
            return;
        }

        if (errorMessage) {
            errorMessage.textContent = "Invalid username or password.";
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
        const power = Number(log.power_estimate) || 0;
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
        const response = await fetch(`${BASE_URL}/logs`);
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

    if (sessionStorage.getItem(AUTH_KEY) !== "true") {
        window.location.href = "index.html";
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
