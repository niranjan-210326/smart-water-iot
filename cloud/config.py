import os

# Use environment variable in production to avoid hardcoding secrets.
MONGO_URI = os.getenv("MONGO_URI", "your_mongodb_connection_string")
