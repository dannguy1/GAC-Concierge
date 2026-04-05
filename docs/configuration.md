# Configuration & Deployment

## Environment Variables (`.env`)

Create a `.env` file in the project root. All variables are optional with sensible defaults.

```env
# LLM Backend (OpenAI-compatible)
LLM_BASE_URL=http://localhost:11434/v1   # Ollama default
LLM_MODEL=openai/gpt-4o-mini            # or llama3.2:latest for local
LLM_API_KEY=ollama                       # ignored by Ollama; use real key for OpenAI

# API Server
API_PORT=8000
ADMIN_API_KEY=your-secure-reload-key    # protects /v1/reload

# Text-to-Speech
ENABLE_SERVER_AUDIO=false               # set true to enable Kokoro TTS

# Data Paths (optional — defaults to project-relative paths)
MENU_PATH=data/menu.json
FACTS_PATH=data/facts.json

# Frontend (used by gac_service.sh reference only)
APP_PORT=8501
BACKEND_URL=http://127.0.0.1:8000
```

## Service Management

```bash
./gac_service.sh start    # Start backend + frontend
./gac_service.sh stop     # Stop both
./gac_service.sh restart  # Stop then start
./gac_service.sh status   # Show PID and running state
```

PIDs are stored in `backend.pid` and `frontend.pid` at the project root.

The frontend is started inside a `while true` restart loop to automatically recover from Vite crashes (e.g., `ECONNRESET` from dropped browser connections).

## Starting Services Manually

```bash
# Backend (from project root)
venv/bin/python backend/api.py

# Frontend
cd frontend && npm run dev

# Mobile Metro (requires EAS project auth)
cd mobile
EXPO_TOKEN=<token> npx expo start --lan
```

## Dependencies

### Python

```bash
python3 -m venv venv
venv/bin/pip install -r requirements.txt
```

Key packages: `fastapi`, `uvicorn`, `openai`, `sentence-transformers`, `faiss-cpu`, `rank_bm25`, `numpy`, `python-dotenv`, `kokoro` (TTS, optional).

### Node.js / Web

```bash
cd frontend && npm install
```

### Node.js / Mobile

```bash
cd mobile && npm install
```

## LLM Configuration

### Ollama (Local)

```bash
# Install Ollama, then pull a model
ollama pull llama3.2:latest
# or for better quality:
ollama pull qwen2.5:14b
```

Set in `.env`:
```env
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=llama3.2:latest
LLM_API_KEY=ollama
```

### OpenAI / Cloud

```env
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
LLM_API_KEY=sk-...
```

Any OpenAI-compatible endpoint works (Together, Groq, OpenRouter, etc.).

## Hot Reload (Menu / RAG)

After updating `data/menu.json` or `data/facts.json`, trigger a reload without restarting:

```bash
curl -X POST http://localhost:8000/v1/reload \
     -H "x-api-key: your-secure-reload-key"
```

This:
1. Re-reads `menu.json` into `MenuManager`
2. Recomputes the MD5 hash
3. If hash changed, rebuilds FAISS (`IndexFlatL2`) index, re-trains BM25
4. Saves new cache to `cache/rag/`

## Mobile APK Distribution

### EAS Cloud Build (recommended)

```bash
cd mobile
EXPO_TOKEN=<token> ./node_modules/.bin/eas build \
    --platform android --profile preview --non-interactive
```

Download the APK from the Expo dashboard or the URL printed in the output.

### Local Build

Requirements:
- Java 17 (`sudo apt install openjdk-17-jdk-headless`)
- Android SDK at `~/android-sdk` with:
  - `platform-tools`, `platforms;android-35`, `build-tools;35.0.0`
  - `ndk;27.1.12297006`, `cmake;3.22.1`
- Environment variables in `~/.bashrc`:
  ```bash
  export ANDROID_HOME=~/android-sdk
  export ANDROID_SDK_ROOT=~/android-sdk
  export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin
  ```

```bash
cd mobile && ./build_apk.sh release
# Output: mobile/gac-concierge-release.apk
```

### Sideloading (Android)

Serve the APK over HTTP on the local network:
```bash
cd mobile && python3 -m http.server 9000
# On tablet: http://192.168.10.3:9000/gac-concierge-release.apk
```

Enable "Install from unknown sources" in Android Settings before installing.

## CORS Configuration

The backend's CORS allowlist is hardcoded in `backend/api.py`:

```python
allow_origins=[
    "http://localhost:3000",
    "http://localhost:8501",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8501",
    "http://127.0.0.1:5173",
    "http://192.168.10.3:8501",
    "http://192.168.10.3:5173",
]
```

Add new origins here if accessing the web frontend from a different IP or port.

Note: The mobile app connects directly to port 8000 (not through Vite proxy), so its requests are not subject to CORS — they originate from the device, not a browser origin.

## Static Image Files

Menu item images are served as static files:

```
data/images/             → http://server:8000/images/filename.jpg
data/downloaded_images/  → http://server:8000/downloaded_images/filename.jpg
```

`getImageUrl()` in both `services/api.js` files constructs the full URL from the `image` field in `menu.json`.

## File Structure Summary

```
GAC-Concierge/
├── .env                    Environment variables (not committed)
├── .gitignore
├── config.py               Central config — reads .env
├── requirements.txt        Python dependencies
├── gac_service.sh          Service manager script
├── setup_dev.sh            Dev environment setup
├── verify_dependencies.sh  Dependency check script
├── backend/
│   ├── api.py              FastAPI entry point
│   ├── agent.py            WaitstaffAgent (ReAct)
│   ├── rag_retriever.py    Hybrid RAG (FAISS + BM25)
│   ├── menu_manager.py     Menu data loader
│   ├── tts_client.py       Kokoro TTS
│   └── llm_client.py       OpenAI-compatible LLM client
├── frontend/               React web app (Vite)
├── mobile/                 React Native Expo app
├── data/
│   ├── menu.json           Menu items (canonical source)
│   └── facts.json          Restaurant facts
├── cache/
│   └── rag/                FAISS index + metadata (auto-generated)
├── docs/                   Design documentation (this directory)
├── models/                 Local model files (gitignored)
└── piper/                  Piper TTS binaries (gitignored)
```
