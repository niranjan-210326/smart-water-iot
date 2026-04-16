from __future__ import annotations

from collections import deque
from threading import Lock

from cloud.config import MONGO_URI

try:
    from pymongo import MongoClient
    from pymongo.errors import PyMongoError
except ImportError:  # pragma: no cover - handled at runtime on target device
    MongoClient = None  # type: ignore[assignment]
    PyMongoError = Exception  # type: ignore[assignment]

DB_NAME = "smart_water_db"
COLLECTION_NAME = "motor_logs"

_client = None
_collection = None
_connected_logged = False
_pending_logs: deque[dict] = deque()
_queue_lock = Lock()


def connect_to_mongo():
    global _client, _collection, _connected_logged

    if _collection is not None:
        # Reuse active collection handle to avoid reconnect overhead each log event.
        return _collection

    if MongoClient is None:
        print("[CLOUD] pymongo not installed, cloud sync disabled")
        return None

    if not MONGO_URI:
        print("[CLOUD] MongoDB URI not configured, cloud sync disabled")
        return None

    try:
        _client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=4000)
        # Ping validates network/auth quickly so failures are caught before inserts.
        _client.admin.command("ping")
        _collection = _client[DB_NAME][COLLECTION_NAME]
        if not _connected_logged:
            print("[CLOUD] Connected to MongoDB")
            _connected_logged = True
    except PyMongoError:
        _collection = None
        print("[CLOUD] Sync failed, will retry later")

    return _collection


def _insert_log(log_data: dict) -> bool:
    collection = connect_to_mongo()
    if collection is None:
        return False

    try:
        collection.insert_one(log_data)
        print("[CLOUD] Log synced successfully")
        return True
    except PyMongoError:
        print("[CLOUD] Sync failed, will retry later")
        return False


def _retry_pending_logs() -> None:
    # Flush queued payloads first to preserve event order once connectivity returns.
    while True:
        with _queue_lock:
            if not _pending_logs:
                return
            payload = _pending_logs[0]

        if _insert_log(payload):
            with _queue_lock:
                if _pending_logs and _pending_logs[0] == payload:
                    _pending_logs.popleft()
        else:
            return


def sync_log_to_cloud(log_data: dict) -> None:
    # Opportunistic retry keeps system resilient without blocking local control loops.
    _retry_pending_logs()
    if _insert_log(log_data):
        return

    with _queue_lock:
        _pending_logs.append(log_data)


# Future scope:
# - Expose cloud data to a remote dashboard.
# - Add mobile app notifications and monitoring.
