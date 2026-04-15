#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PID=""
EMBEDDED_PID=""

cleanup() {
    echo ""
    echo "[RUN] Stopping services..."
    if [[ -n "${EMBEDDED_PID}" ]] && kill -0 "${EMBEDDED_PID}" 2>/dev/null; then
        kill "${EMBEDDED_PID}" 2>/dev/null || true
    fi
    if [[ -n "${BACKEND_PID}" ]] && kill -0 "${BACKEND_PID}" 2>/dev/null; then
        kill "${BACKEND_PID}" 2>/dev/null || true
    fi
    wait || true
    echo "[RUN] All services stopped."
}

trap cleanup INT TERM EXIT

echo "[RUN] Starting Flask backend..."
python3 "${PROJECT_ROOT}/cloud/sync.py" &
BACKEND_PID=$!

if [[ ! -x "${PROJECT_ROOT}/embedded/water_system" ]]; then
    echo "[RUN] Embedded executable not found. Building with make..."
    (cd "${PROJECT_ROOT}/embedded" && make)
fi

echo "[RUN] Starting embedded control loop..."
(cd "${PROJECT_ROOT}/embedded" && ./water_system) &
EMBEDDED_PID=$!

echo "[RUN] System started."
echo "[RUN] Open frontend/index.html in your browser."
echo "[RUN] Press Ctrl+C to stop everything."

wait
