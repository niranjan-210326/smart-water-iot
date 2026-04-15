# Smart Water Management with Cloud Sync

Smart Water Management is an embedded IoT system designed for Raspberry Pi 5 that automates water motor control, supports manual override from a web dashboard, detects operational faults, and synchronizes usage history to the cloud.

## Features

- Automatic and manual motor control (`AUTO` / `MANUAL`)
- Real-time water level monitoring and status updates
- Fault detection for dry-run and no-water conditions
- Live frontend dashboard with motor and mode controls
- Persistent usage history in SQLite
- Cloud synchronization to MongoDB Atlas (best-effort retry queue)

## Architecture

- **Embedded Layer (C)**: Reads water level, executes motor control logic, writes runtime status to `status.json`.
- **Backend Layer (Flask)**: Bridges frontend controls and embedded commands, logs motor usage cycles, exposes APIs.
- **Frontend Layer (Web UI)**: Login, dashboard controls, live status, and history view.
- **Cloud Layer (MongoDB)**: Stores synced motor logs for remote monitoring and future analytics.

## Architecture Diagram (Text)

```text
Frontend (Web UI)
        |
        v
Flask Backend
        |
        v
command.json <----> Embedded C System
        |
        v
status.json
        |
        v
SQLite DB -----> MongoDB Cloud
```

## Folder Structure

```text
smart-water-iot/
├── backend/
│   └── database.py          # SQLite init + log insert/query
├── cloud/
│   ├── config.py            # MongoDB URI config
│   ├── mongo_sync.py        # MongoDB sync + retry queue
│   └── sync.py              # Flask API + monitoring thread
├── data/
│   ├── command.json         # Backend to embedded command channel
│   ├── status.json          # Embedded to backend status channel
│   └── motor.db             # Local SQLite history
├── embedded/
│   ├── main.c               # Core loop (AUTO/MANUAL + fault detection)
│   ├── motor.c/.h           # Motor GPIO abstraction
│   ├── sensor.c/.h          # Water level simulation
│   ├── fault.c/.h           # Fault logic
│   ├── utils.c/.h           # Time + JSON helpers
│   ├── Makefile             # C build config
│   └── water_system         # Embedded executable (build output)
├── frontend/
│   ├── index.html           # Login page
│   ├── dashboard.html       # Live control and monitoring
│   ├── history.html         # Motor usage history table
│   ├── script.js            # Frontend API integration logic
│   └── styles.css           # UI styling
├── docs/
│   └── demo_flow.md         # Presentation walkthrough
└── run_all.sh               # Starts backend + embedded together
```

## How To Run

### 1) Prerequisites

- Raspberry Pi OS / Linux
- Python 3
- GCC + make
- (Optional cloud) MongoDB Atlas URI

Install essentials:

```bash
sudo apt update
sudo apt install build-essential python3 python3-pip -y
pip3 install flask pymongo
```

### 2) Run everything with one script

```bash
chmod +x run_all.sh
./run_all.sh
```

This starts:
- Flask backend (`cloud/sync.py`)
- Embedded executable (`embedded/water_system`)

Then open:
- `frontend/index.html`

### 3) Manual run (alternative)

Backend:

```bash
python3 cloud/sync.py
```

Embedded:

```bash
cd embedded
make
./water_system
```

Frontend:
- Open `frontend/index.html` in a browser.

## API Summary

- `GET /status` -> current live system state
- `GET /logs` -> usage history from SQLite
- `POST /mode` -> set mode (`AUTO` or `MANUAL`)
- `POST /motor/control` -> set motor command (`ON` or `OFF`)

## Technologies Used

- **C (Embedded, C99)**
- **Python (Flask)**
- **SQLite**
- **MongoDB Atlas (pymongo)**
- **HTML / CSS / JavaScript (Fetch API)**

## Optional Future Enhancements

- Mobile app for remote control and live notifications
- SMS alerts for dry-run/no-water faults
- Predictive maintenance using historical motor runtime analytics
