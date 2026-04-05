# GAC-Concierge — System Architecture

## Overview

GAC-Concierge is an AI-powered restaurant concierge for **Garlic & Chives** (Garden Grove, CA). A customer-facing AI waiter named **Kristin** takes orders, answers questions, and manages a running order pad across three client surfaces sharing a single backend.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Clients                                  │
│                                                                  │
│  ┌──────────────────┐  ┌────────────────┐  ┌─────────────────┐ │
│  │  Web Browser     │  │ Android Tablet │  │   iPad (iOS)    │ │
│  │  React + Vite    │  │ React Native   │  │ React Native    │ │
│  │  :8501           │  │ Expo APK       │  │ Expo Go         │ │
│  └────────┬─────────┘  └───────┬────────┘  └────────┬────────┘ │
└───────────┼────────────────────┼────────────────────┼──────────┘
            │  HTTP              │  HTTP LAN           │  HTTP LAN
            ▼                   ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FastAPI Backend  :8000                        │
│                                                                  │
│   /v1/chat ──► WaitstaffAgent (ReAct loop)                      │
│                  ├─► RAGRetriever (FAISS + BM25)                │
│                  └─► LLM (OpenAI-compatible API)                │
│                                                                  │
│   /v1/menu ──► MenuManager (menu.json)                          │
│   /v1/tts  ──► TTSClient (Kokoro)                               │
│   /v1/checkout ──► Server-side price validation                 │
│   /v1/reload ──► Hot-reload (API key protected)                 │
│                                                                  │
│   Static: /images, /downloaded_images                           │
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Data Layer                                     │
│   data/menu.json     – 160+ menu items (canonical source)       │
│   data/facts.json    – Restaurant info (hours, history, FAQ)    │
│   cache/rag/         – FAISS index + JSON/numpy metadata        │
└─────────────────────────────────────────────────────────────────┘
```

## Component Inventory

| Component | Technology | Port | Purpose |
|-----------|------------|------|---------|
| Backend API | FastAPI + Uvicorn | 8000 | LLM agent, menu, TTS, checkout |
| Web Frontend | React 18 + Vite | 8501 | Browser-based concierge UI |
| Mobile App | React Native + Expo | — | Android APK + iOS Expo Go |
| Expo Metro | Node.js | 8081 | Mobile dev bundler (dev only) |
| LLM | OpenAI-compatible | 11434 (Ollama) | Language model inference |

## Request Lifecycle — `/v1/chat`

```
User types message
       │
       ▼
Client (App.jsx / App.js)
  handleSendMessage()
  └─► services/api.js  sendChat(messages, language, signal)
           │  POST /v1/chat
           ▼
  backend/api.py  chat_endpoint()
  ├── Validates & cleans message list
  ├── Calls agent.run(messages, current_language)
  │       │
  │       ▼
  │   WaitstaffAgent.run()   ──── ReAct Loop (max 5 steps) ────
  │   ├── Build system prompt (menu categories, tool docs)      │
  │   ├── Trim history → last 40 messages                       │
  │   ├── Call LLM (_call_llm)  ◄──────────────────────────────┘
  │   ├── Parse response for "Action: / Action Input:"
  │   │   ├── lookup_menu  → RAGRetriever.retrieve_items()
  │   │   ├── lookup_info  → RAGRetriever.retrieve_items()
  │   │   ├── add_to_cart  → validates item, appends cart_updates
  │   │   ├── set_general_note → stores allergy/note
  │   │   ├── set_language → updates detected_language
  │   │   └── confirm_order → sets order_confirmed = True
  │   └── Returns dict: {text, language, mentioned_items,
  │                       cart_updates, general_note, order_confirmed}
  ├── Strips <think>…</think> blocks
  └── Returns JSON response to client

Client receives response
  ├── Appends assistant message to chat
  ├── Merges cart_updates into cart state
  ├── Updates mentionedItems → MenuVisualizer
  └── Sets orderConfirmed if flagged
```

## Network Topology

```
Server host: 192.168.10.3
  :8000   FastAPI backend  (bound to 0.0.0.0)
  :8081   Expo Metro dev bundler (LAN)
  :8501   Vite React web frontend (LAN)

LAN clients:
  Android tablet  →  http://192.168.10.3:8000
  iPad            →  http://192.168.10.3:8000
  Browser         →  http://192.168.10.3:8501
                      (Vite proxies /v1 → :8000)
```

## Service Management

The `gac_service.sh` script manages backend and frontend processes:

```bash
./gac_service.sh start | stop | restart | status
```

- Backend: started with `setsid`, PID in `backend.pid`
- Frontend (Vite): started in a `while true` restart loop (auto-recovers from `ECONNRESET` crashes), PID in `frontend.pid`
- Mobile Metro: started separately with `EXPO_TOKEN` env var

## Data Files

| File | Description |
|------|-------------|
| `data/menu.json` | Array of menu items. Each item: `item_name`, `item_viet`, `category`, `price`, `description`, `popular`, `pronunciation`, `image` |
| `data/facts.json` | Array of general info entries: `title`, `content`, `keywords` |
| `cache/rag/faiss_index.bin` | Serialized FAISS IVF index |
| `cache/rag/metadata.json` | Data hash, menu_items list, item_chunks list |
| `cache/rag/embeddings.npy` | Numpy array of sentence embeddings |

The RAG cache is automatically invalidated when `data/menu.json` changes (SHA-256 hash comparison).
