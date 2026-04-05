# GAC-Concierge Documentation

AI-powered restaurant concierge for **Garlic & Chives** (Garden Grove, CA).

## Documents

| Document | Description |
|----------|-------------|
| [architecture.md](architecture.md) | System overview, component inventory, request lifecycle, network topology |
| [backend.md](backend.md) | FastAPI backend, WaitstaffAgent ReAct loop, RAG retriever, TTS, API reference |
| [frontend-web.md](frontend-web.md) | React web frontend, state design, layout, API boundary, TTS playback |
| [mobile.md](mobile.md) | React Native Expo app, portrait/landscape layouts, APK builds, iOS/Android differences |
| [configuration.md](configuration.md) | Environment variables, service management, LLM setup, deployment, hot reload |

## Quick Start

```bash
# 1. Install dependencies
python3 -m venv venv && venv/bin/pip install -r requirements.txt
cd frontend && npm install && cd ..
cp .env.example .env   # edit as needed

# 2. Start services
./gac_service.sh start

# 3. Open browser
http://192.168.10.3:8501

# 4. Check health
curl http://localhost:8000/v1/health
```

## Key Design Decisions

- **ReAct Agent**: The LLM outputs structured plain-text tool calls (`Action: / Action Input:`). The agent executes tools, feeds observations back, and loops up to 5 times before returning a final answer.
- **Hybrid RAG**: Menu and facts are retrieved via FAISS (semantic, 60%) + BM25 (keyword, 40%) rank fusion — prevents hallucination by only letting the LLM reference items it has explicitly retrieved.
- **Server-side price authority**: `/v1/checkout` always uses menu prices from disk, ignoring any price sent by the client.
- **Kitchen language rule**: All `add_to_cart` and `set_general_note` tool inputs must be in English, regardless of the customer's language.
- **No Tailwind**: Web frontend uses vanilla CSS with CSS variables for theming.
- **Single API boundary**: Both web and mobile have a `services/api.js` that is the only place `fetch()` is called.
- **Android cleartext fix**: A custom Expo config plugin (`plugins/withCleartextTraffic.js`) patches `AndroidManifest.xml` during both local and EAS cloud builds.
