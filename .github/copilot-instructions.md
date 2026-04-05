# GAC-Concierge Copilot Instructions

## Project Overview

GAC-Concierge is an AI-powered restaurant concierge for **Garlic & Chives** (Garden Grove, CA). It pairs a FastAPI backend (LLM + RAG) with a React frontend to simulate a professional waiter named "Kristin."

---

## Commands

### Backend
```bash
# Run from project root (use venv)
venv/bin/python backend/api.py

# Health check
curl http://localhost:8000/v1/health
```

### Frontend
```bash
cd frontend
npm run dev      # Dev server on http://localhost:5173
npm run build    # Production build
npm run lint     # ESLint
```

### Service Manager
```bash
./gac_service.sh start | stop | restart | status
```

---

## Architecture

```
GAC-Concierge/
├── config.py            # Central config — reads all env vars from .env
├── backend/
│   ├── api.py           # FastAPI app (entry point, run from project root)
│   ├── agent.py         # WaitstaffAgent — ReAct loop, tool dispatch, LLM calls
│   ├── rag_retriever.py # Hybrid search: FAISS (semantic) + BM25 (keyword)
│   ├── menu_manager.py  # Loads/reloads data/menu.json
│   ├── tts_client.py    # Kokoro TTS wrapper; streams audio bytes
│   └── llm_client.py    # OpenAI-compatible client (points to Ollama by default)
├── frontend/src/
│   ├── App.jsx          # Root state (messages, cart, language, orderConfirmed)
│   ├── components/
│   │   ├── ChatInterface.jsx   # Message thread, language picker, input bar
│   │   ├── MenuVisualizer.jsx  # Shows item cards for items mentioned by agent
│   │   └── OrderPad.jsx        # Slide-in cart drawer, checkout trigger
│   └── services/api.js         # All fetch() calls to backend — single source of truth
├── data/
│   ├── menu.json        # Menu items (canonical source)
│   └── facts.json       # General restaurant info (hours, history, etc.)
└── cache/rag/           # Persisted FAISS index (auto-invalidated on menu.json change)
```

### Request Flow
1. User types → `App.jsx` `handleSendMessage` → `services/api.js sendChat`
2. `POST /v1/chat` → `WaitstaffAgent.run()` enters a **ReAct loop** (max 3 steps)
3. Agent emits `Action: tool_name\nAction Input: ...` → backend dispatches to `lookup_menu`, `add_to_cart`, etc.
4. Response returns `{ text, language, mentioned_items, cart_updates, general_note, order_confirmed }`
5. Frontend merges `cart_updates` into cart state and updates `MenuVisualizer` from `mentioned_items`

### RAG System
- `RAGRetriever` combines **FAISS** (semantic, `all-MiniLM-L6-v2`) + **BM25** with weighted rank fusion (60/40)
- Indexes both `menu.json` items and `facts.json` info entries
- FAISS index persisted to `cache/rag/`; auto-rebuilt when `menu.json` hash changes
- Call `POST /v1/reload` (with `x-api-key` header) to hot-reload menu + RAG without restart

### LLM / TTS
- LLM uses an **OpenAI-compatible client** — defaults to Ollama (`http://localhost:11434/v1`)
- Swap to any OpenAI-compatible API via `.env`: `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`
- TTS uses **Kokoro** with per-language voice mappings in `config.py::KOKORO_VOICES`
- TTS disabled by default (`ENABLE_SERVER_AUDIO=false` in `.env`)

---

## Key Conventions

### No TailwindCSS
Use **vanilla CSS only**. Component-scoped class names, CSS variables for theming (e.g., `var(--color-brand-green)`).

### Strict API Boundary
All backend calls go through `frontend/src/services/api.js`. Never call `fetch()` directly from components.

### Cart Item Shape
Cart objects carry both `item_name` (sent to `/v1/checkout`) and `name` (used for UI display):
```js
{ item_name: "Pho Tai", name: "Pho Tai", qty: 2, notes: "", price: 12.95 }
```

### UI → LLM System Events
Cart actions (add/remove/qty change) from the UI send a passive `[System Event]` message to the LLM to keep conversation context in sync:
```js
handleSendMessage(`[System Event] User explicitly clicked a button to add 1x ${item.item_name} to their order cart.`);
```

### Agent Tool Format (ReAct)
The agent communicates tool calls in plain text — do not change this format:
```
Action: lookup_menu
Action Input: vegetarian options
```
`<think>` blocks from reasoning models are stripped server-side before returning to the frontend.

### Server-Side Price Authority
`/v1/checkout` always uses **menu prices from disk**, not from the client. Client-sent prices are ignored to prevent tampering.

### Singletons
`MenuManager`, `TTSClient`, `WaitstaffAgent`, and `RAGRetriever` (`get_retriever()`) are module-level singletons initialized at startup. Do not instantiate new instances per request.

### Config / Environment
All config flows through `config.py` which reads `.env`. Never hardcode URLs, keys, or paths — use `config.*` in Python or the `API_BASE_URL` constant in `services/api.js`.

### Kitchen Language Rule
All `add_to_cart` and `set_general_note` agent tool calls must be in **English**, regardless of the user's chosen language. The UI may display in any language; the kitchen only reads English.
