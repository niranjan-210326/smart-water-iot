import os

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

if load_dotenv is not None:
    load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "")
SECRET_KEY = os.getenv("SECRET_KEY", "smart-water-dev-secret")
