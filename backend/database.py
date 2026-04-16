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
            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_time TEXT NOT NULL,
                end_time TEXT,
                duration INTEGER,
                power REAL,
                fault TEXT NOT NULL
            )
            """
        )
        connection.commit()


def start_log(start_time: datetime, fault: str = "NONE") -> int:
    fault_text = (fault or "NONE").upper()

    with sqlite3.connect(DB_PATH) as connection:
        cursor = connection.execute(
            """
            INSERT INTO logs (start_time, end_time, duration, power, fault)
            VALUES (?, NULL, NULL, NULL, ?)
            """,
            (
                start_time.strftime("%Y-%m-%d %H:%M:%S"),
                fault_text,
            ),
        )
        connection.commit()
        return int(cursor.lastrowid)


def complete_log(log_id: int, end_time: datetime, fault: str) -> dict | None:
    with sqlite3.connect(DB_PATH) as connection:
        connection.row_factory = sqlite3.Row
        row = connection.execute(
            "SELECT id, start_time FROM logs WHERE id = ?",
            (log_id,),
        ).fetchone()

        if row is None:
            return None

        start_time = datetime.strptime(row["start_time"], "%Y-%m-%d %H:%M:%S")
        safe_duration = max(0, int((end_time - start_time).total_seconds()))
        power = round(safe_duration * POWER_FACTOR, 2)
        fault_text = (fault or "NONE").upper()

        connection.execute(
            """
            UPDATE logs
            SET end_time = ?, duration = ?, power = ?, fault = ?
            WHERE id = ?
            """,
            (
                end_time.strftime("%Y-%m-%d %H:%M:%S"),
                safe_duration,
                power,
                fault_text,
                log_id,
            ),
        )
        connection.commit()

    return {
        "id": log_id,
        "date": start_time.strftime("%Y-%m-%d"),
        "start_time": start_time.strftime("%H:%M:%S"),
        "end_time": end_time.strftime("%H:%M:%S"),
        "duration": safe_duration,
        "power": power,
        "fault": fault_text,
    }


def insert_log(start_time: datetime, end_time: datetime, duration: int, fault: str) -> None:
    log_id = start_log(start_time, fault)
    _ = duration
    complete_log(log_id, end_time, fault)


def get_all_logs() -> list[dict]:
    with sqlite3.connect(DB_PATH) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            """
            SELECT
                substr(start_time, 1, 10) AS date,
                substr(start_time, 12, 8) AS start_time,
                COALESCE(substr(end_time, 12, 8), '--') AS end_time,
                COALESCE(duration, 0) AS duration,
                COALESCE(power, 0) AS power,
                fault
            FROM logs
            ORDER BY id DESC
            """
        ).fetchall()

    return [dict(row) for row in rows]
