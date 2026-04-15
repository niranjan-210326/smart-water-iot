from __future__ import annotations

import json
import os
import sys
import threading
import time
from datetime import datetime
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from backend.database import get_all_logs, init_db, insert_log
from cloud.mongo_sync import connect_to_mongo, sync_log_to_cloud

DATA_DIR = PROJECT_ROOT / "data"
COMMAND_FILE = DATA_DIR / "command.json"
STATUS_FILE = DATA_DIR / "status.json"
DEFAULT_COMMAND = {"mode": "AUTO", "motor": "OFF"}
DEFAULT_STATUS = {
    "water_level": 0,
    "motor": 0,
    "mode": "AUTO",
    "fault": "NONE",
    "timestamp": "--",
}
VALID_MODES = {"AUTO", "MANUAL"}
VALID_MOTOR = {"ON", "OFF"}
MONITOR_INTERVAL_SECONDS = 2
monitor_state = {
    "previous_motor": 0,
    "run_start": None,
    "run_fault": "NONE",
}


def parse_status_timestamp(timestamp: str | None) -> datetime:
    if not timestamp:
        # Fall back to local clock to keep logging alive if embedded timestamp is absent.
        return datetime.now()
    try:
        return datetime.strptime(timestamp, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return datetime.now()


def read_embedded_status() -> dict | None:
    if not STATUS_FILE.exists():
        return None
    try:
        with STATUS_FILE.open("r", encoding="utf-8") as file:
            raw_status = json.load(file)
    except (json.JSONDecodeError, OSError):
        return None

    return {
        "motor": 1 if raw_status.get("motor") in (1, "1", "ON") else 0,
        "fault": str(raw_status.get("fault", "NONE")).upper(),
        "timestamp": str(raw_status.get("timestamp", "")),
    }


def monitor_motor_usage() -> None:
    while True:
        status = read_embedded_status()
        if status is not None:
            motor = status["motor"]
            fault = status["fault"]
            timestamp = parse_status_timestamp(status["timestamp"])
            previous_motor = monitor_state["previous_motor"]

            # Transition tracking prevents duplicate records and captures complete motor runs.
            if previous_motor == 0 and motor == 1:
                monitor_state["run_start"] = timestamp
                monitor_state["run_fault"] = fault
            elif previous_motor == 1 and motor == 1 and fault != "NONE":
                # Keep the latest fault during an active run so final log reflects real condition.
                monitor_state["run_fault"] = fault
            elif previous_motor == 1 and motor == 0:
                start_time = monitor_state["run_start"]
                if start_time is not None:
                    duration = int((timestamp - start_time).total_seconds())
                    fault = monitor_state["run_fault"]
                    log_data = {
                        "date": start_time.strftime("%Y-%m-%d"),
                        "start_time": start_time.strftime("%H:%M:%S"),
                        "end_time": timestamp.strftime("%H:%M:%S"),
                        "duration": max(0, duration),
                        "power_estimate": round(max(0, duration) * 0.5, 2),
                        "fault": fault,
                    }
                    # Local persistence is primary; cloud sync is best-effort and non-blocking.
                    insert_log(start_time, timestamp, duration, fault)
                    sync_log_to_cloud(log_data)
                monitor_state["run_start"] = None
                monitor_state["run_fault"] = "NONE"

            monitor_state["previous_motor"] = motor

        time.sleep(MONITOR_INTERVAL_SECONDS)


def read_current_command() -> dict:
    if not COMMAND_FILE.exists():
        return dict(DEFAULT_COMMAND)

    try:
        with COMMAND_FILE.open("r", encoding="utf-8") as file:
            data = json.load(file)
    except (json.JSONDecodeError, OSError):
        return dict(DEFAULT_COMMAND)

    mode = str(data.get("mode", DEFAULT_COMMAND["mode"])).upper()
    motor = str(data.get("motor", DEFAULT_COMMAND["motor"])).upper()

    if mode not in VALID_MODES:
        mode = DEFAULT_COMMAND["mode"]
    if motor not in VALID_MOTOR:
        motor = DEFAULT_COMMAND["motor"]

    return {"mode": mode, "motor": motor}


def write_command_atomic(command: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    temp_file = COMMAND_FILE.with_suffix(".tmp")
    payload = {
        "mode": command["mode"],
        "motor": command["motor"],
    }

    with temp_file.open("w", encoding="utf-8") as file:
        json.dump(payload, file, indent=2)
        file.write("\n")
        file.flush()
        os.fsync(file.fileno())

    os.replace(temp_file, COMMAND_FILE)


def read_status_snapshot() -> dict:
    status = dict(DEFAULT_STATUS)
    command = read_current_command()

    status["mode"] = command["mode"]
    status["motor"] = 1 if command["motor"] == "ON" else 0

    if not STATUS_FILE.exists():
        return status

    try:
        with STATUS_FILE.open("r", encoding="utf-8") as file:
            file_status = json.load(file)
    except (json.JSONDecodeError, OSError):
        return status

    if isinstance(file_status.get("water_level"), int):
        status["water_level"] = max(0, min(100, file_status["water_level"]))
    if file_status.get("motor") in (0, 1):
        status["motor"] = file_status["motor"]
    if str(file_status.get("mode", "")).upper() in VALID_MODES:
        status["mode"] = str(file_status["mode"]).upper()
    if file_status.get("fault"):
        status["fault"] = str(file_status["fault"]).upper()
    if file_status.get("timestamp"):
        status["timestamp"] = str(file_status["timestamp"])

    return status


@app.route("/status", methods=["GET"])
def get_status():
    return jsonify(read_status_snapshot()), 200


@app.route("/logs", methods=["GET"])
def get_logs():
    return jsonify(get_all_logs()), 200


@app.route("/mode", methods=["POST"])
def set_mode():
    body = request.get_json(silent=True) or {}
    mode = str(body.get("mode", "")).upper()

    if mode not in VALID_MODES:
        return jsonify({"error": "mode must be AUTO or MANUAL"}), 400

    command = read_current_command()
    command["mode"] = mode
    write_command_atomic(command)

    return jsonify({"status": "ok", "command": command}), 200


@app.route("/motor/control", methods=["POST"])
def set_motor():
    body = request.get_json(silent=True) or {}
    motor = str(body.get("motor", "")).upper()

    if motor not in VALID_MOTOR:
        return jsonify({"error": "motor must be ON or OFF"}), 400

    command = read_current_command()
    command["motor"] = motor
    write_command_atomic(command)

    return jsonify({"status": "ok", "command": command}), 200


if __name__ == "__main__":
    init_db()
    connect_to_mongo()
    write_command_atomic(read_current_command())
    monitor_thread = threading.Thread(target=monitor_motor_usage, daemon=True)
    monitor_thread.start()
    app.run(host="0.0.0.0", port=5000, debug=False)
