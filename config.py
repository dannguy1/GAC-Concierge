import os
from dotenv import load_dotenv

# Load environment variables from .env file (override any existing)
load_dotenv(override=True)

# Base paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def get_path(env_var, default_relative):
    """
    Helper to resolve paths:
    - If env var is absolute, use it.
    - If env var is relative, join with BASE_DIR.
    - If env var is missing, use default (joined with BASE_DIR).
    """
    raw_path = os.getenv(env_var, default_relative)
    if os.path.isabs(raw_path):
        return raw_path
    return os.path.join(BASE_DIR, raw_path)

# Data Directories
DATA_DIR = os.path.join(BASE_DIR, "data") # Default fallback if needed
IMAGES_DIR = get_path("IMAGES_DIR", "data/images")
MENU_PATH = get_path("MENU_PATH", "data/menu.json")
FACTS_PATH = get_path("FACTS_PATH", "data/facts.json")

# -------------
# TTS Configuration
# -------------
KOKORO_VOICES = {
    "en": "af_heart",     # American English
    "vi": "af_heart",     # Fallback (Vietnamese not natively supported)
    "es": "ef_dora",      # Spanish
    "zh": "zf_xiaoxiao",  # Mandarin Chinese
    "fr": "ff_siwis",     # French
    "hi": "hf_alpha",     # Hindi
    "it": "if_sara",      # Italian
    "pt": "pf_dora",      # Brazilian Portuguese
    "ja": "jf_alpha",     # Japanese
}
TTS_SAMPLE_RATE = 24000  # Kokoro uses 24000


# LLM Configuration
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://localhost:11434/v1")
LLM_API_KEY = os.getenv("LLM_API_KEY", "ollama")
LLM_MODEL = os.getenv("LLM_MODEL", "llama3.2:latest")

# Service Configuration
APP_PORT = int(os.getenv("APP_PORT", 8501))
# Convert string 'true'/'false' to boolean
ENABLE_SERVER_AUDIO = os.getenv("ENABLE_SERVER_AUDIO", "false").lower() == "true"

# Backend Configuration
BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000")
API_PORT = int(os.getenv("API_PORT", 8000))
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "secret_dev_key")
if "localhost" in BACKEND_URL:
    BACKEND_URL = BACKEND_URL.replace("localhost", "127.0.0.1")
