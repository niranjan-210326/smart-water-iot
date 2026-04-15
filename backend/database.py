import sqlite3
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "motor.db"
POWER_FACTOR = 0.5


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS motor_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                duration INTEGER NOT NULL,
                power_estimate REAL NOT NULL,
                fault TEXT NOT NULL
            )
            """
        )
        connection.commit()


def insert_log(start_time: datetime, end_time: datetime, duration: int, fault: str) -> None:
    safe_duration = max(0, int(duration))
    power_estimate = round(safe_duration * POWER_FACTOR, 2)
    fault_text = (fault or "NONE").upper()

    with sqlite3.connect(DB_PATH) as connection:
        connection.execute(
            """
            INSERT INTO motor_logs (date, start_time, end_time, duration, power_estimate, fault)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                start_time.strftime("%Y-%m-%d"),
                start_time.strftime("%H:%M:%S"),
                end_time.strftime("%H:%M:%S"),
                safe_duration,
                power_estimate,
                fault_text,
            ),
        )
        connection.commit()


def get_all_logs() -> list[dict]:
    with sqlite3.connect(DB_PATH) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            """
            SELECT date, start_time, end_time, duration, power_estimate, fault
            FROM motor_logs
            ORDER BY id DESC
            """
        ).fetchall()

    return [dict(row) for row in rows]
