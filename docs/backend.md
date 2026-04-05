# Backend Design

## Entry Point

Run from the **project root** (not from `backend/`):

```bash
venv/bin/python backend/api.py
```

Uvicorn binds to `0.0.0.0:8000` so both localhost and LAN clients can connect.

## Module Responsibilities

```
backend/
├── api.py          FastAPI app: routes, CORS, rate limiting, request validation
├── agent.py        WaitstaffAgent: ReAct loop, tool dispatch, LLM orchestration
├── rag_retriever.py Hybrid semantic+keyword retrieval over menu and facts
├── menu_manager.py  Loads and reloads data/menu.json
├── llm_client.py    Thin OpenAI-compatible client (used by WaitstaffAgent)
└── tts_client.py    Kokoro TTS wrapper; yields audio bytes
config.py           Reads all config from .env; single source of truth
```

All core objects are **module-level singletons** initialized at startup:

```python
menu_manager = MenuManager()   # loads menu.json
tts_client   = TTSClient()     # loads Kokoro model
agent        = WaitstaffAgent() # loads retriever, LLM client
```

---

## WaitstaffAgent — ReAct Loop (`agent.py`)

The agent uses a **ReAct** (Reason + Act) pattern: the LLM outputs structured plain-text tool calls; the agent executes them and feeds observations back until the LLM produces a final answer.

### System Prompt

The system prompt is built per-request and includes:
- Persona: Kristin, waiter at Garlic & Chives
- Greeting protocol (first message only)
- Critical workflow (explore → allergy check → confirm → finalize)
- Menu category summary (not full menu)
- Tool documentation with exact usage format
- Hard rules (kitchen language must be English, no hallucination, etc.)

### Message History Windowing

Before passing history to the LLM:
```python
MAX_HISTORY_MESSAGES = 40
trimmed = messages[-MAX_HISTORY_MESSAGES:]
current_messages = [system_prompt] + trimmed
```

This prevents token limit overflow in long sessions.

### ReAct Loop

```
max_steps = 5

for step in range(max_steps):
    response = LLM(current_messages)
    
    if "Action:" in response:
        tool, query = parse(response)
        observation = dispatch_tool(tool, query)
        current_messages += [assistant: response, user: f"Observation: {observation}"]
    else:
        # Final answer — strip think tags and return
        return build_result(response)

# If max_steps exhausted: force a final answer via one more LLM call
```

### Tools

| Tool | Input Format | Purpose |
|------|-------------|---------|
| `lookup_menu` | free-text query | Hybrid RAG search over menu items; returns up to 3 items with price, description |
| `lookup_info` | free-text query | RAG search over facts.json (hours, history, location, owner) |
| `set_language` | language name | Updates detected language for response |
| `add_to_cart` | `Item Name, Qty, Notes` | Fuzzy-matches item against menu, appends to cart_updates; **must be in English** |
| `set_general_note` | free-text | Sets order-level note (allergies, preferences); **must be in English** |
| `confirm_order` | `confirmed` | Marks order as confirmed, unlocks kitchen send |

### Return Shape

```python
{
    "text": str,                # Final response (think tags stripped)
    "language": str,            # Detected/set language
    "mentioned_items": list,    # Menu items shown in UI
    "cart_updates": list,       # [{name, qty, notes}]
    "general_note": str,        # Order-level allergy note
    "order_confirmed": bool,    # True after confirm_order called
    "token_usage": dict,        # prompt + completion tokens
}
```

---

## RAG Retriever (`rag_retriever.py`)

Hybrid retrieval combining semantic search (FAISS) and keyword search (BM25).

### Indexing

Both `data/menu.json` items and `data/facts.json` entries are indexed. For each menu item, a text chunk is built:

```
[Item Name] [Vietnamese Name] [Category] [Price] [Description] [Ingredients] [Tags]
```

### Embedding

Model: `sentence-transformers/all-MiniLM-L6-v2` (80MB, CPU-fast, 384-dim)

Embeddings stored as `cache/rag/embeddings.npy` (numpy binary, not pickle).

### FAISS Index

Type: `IndexIVFFlat` (IVF with flat quantizer, L2 distance)
- `n_list = max(4, sqrt(n_items))` cells
- Trained and saved to `cache/rag/faiss_index.bin`

### BM25

`rank_bm25.BM25Okapi` built from tokenized chunks at load time (fast, not cached).

### Retrieval & Rank Fusion

```python
def retrieve_items(query, top_k=3):
    semantic_results = faiss_search(embed(query), top_k * 2)
    keyword_results  = bm25_search(query.split(), top_k * 2)
    
    # Weighted reciprocal rank fusion
    score = 0.6 * semantic_rank + 0.4 * keyword_rank
    return top_k by fused score
```

### Cache Invalidation

At startup, the SHA-256 hash of `menu.json` content is compared against `metadata.json`'s `data_hash`. If different, the index is rebuilt from scratch.

### Hot Reload

`POST /v1/reload` (requires `x-api-key` header) triggers:
```python
menu_manager.reload()
retriever.reload()
```

Both are mutable singletons — no restart needed.

---

## MenuManager (`menu_manager.py`)

- Loads `data/menu.json` at startup into `self.items`
- Provides `find_items_in_text(text)` for keyword matching in LLM responses
- `reload()` re-reads the file in place

---

## TTS Client (`tts_client.py`)

- Uses **Kokoro** TTS (local, CPU)
- Language → voice mapping defined in `config.KOKORO_VOICES`
- `generate_audio(text, language)` is a generator that yields WAV bytes chunks
- API endpoint collects all chunks: `b"".join(list(tts_client.generate_audio(...)))`
- Returns base64-encoded WAV to client
- **Disabled by default**: `ENABLE_SERVER_AUDIO=false` in `.env`

Voice mapping (`config.py`):

| Language | Voice |
|----------|-------|
| English | `af_heart` |
| Spanish | `ef_dora` |
| Mandarin Chinese | `zf_xiaoxiao` |
| French | `ff_siwis` |
| Hindi | `hf_alpha` |
| Italian | `if_sara` |
| Portuguese | `pf_dora` |
| Japanese | `jf_alpha` |

---

## API Endpoints

### `GET /v1/health`
Returns service status, menu item count, and version string. No auth required.

### `GET /v1/menu`
Returns full `menu.json` as JSON array. No auth required.

### `POST /v1/chat`
Main chat endpoint. Rate-limited to 30 req/60s per IP.

Request:
```json
{ "messages": [...], "language": "English" }
```

- `messages`: Array of `{role, content}`. Max 100 messages, 10,000 chars per message.
- `language`: Optional, default `"English"`.

Response:
```json
{
  "text": "...",
  "language": "English",
  "mentioned_items": [...],
  "cart_updates": [...],
  "general_note": "...",
  "order_confirmed": false
}
```

### `POST /v1/tts`
Returns base64 WAV audio for given text. Returns `{"audio_base64": null}` if `ENABLE_SERVER_AUDIO=false`.

Request: `{ "text": "...", "language": "English" }`

### `POST /v1/checkout`
Validates cart against live menu prices (server is price authority — client prices are ignored).

Request: `{ "cart": [{item_name, quantity, notes, price}], "general_notes": "..." }`

Response: `{ "order": [...], "total": 42.50, "message": "Order validated and received." }`

### `POST /v1/reload`
Hot-reloads menu and RAG index from disk. Requires `x-api-key: <ADMIN_API_KEY>` header.

---

## Security

| Mechanism | Detail |
|-----------|--------|
| Rate limiting | 30 requests / 60s per IP (in-memory, threading.Lock) |
| Input validation | Pydantic models; message max 10,000 chars; max 100 messages |
| Price authority | `/v1/checkout` uses server-side menu prices, ignores client prices |
| Admin key | `/v1/reload` protected by `hmac.compare_digest` key check |
| CORS | Explicit allowlist of known origins (LAN IPs + localhost) |
| `<think>` stripping | LLM reasoning blocks stripped before returning to frontend |

---

## Configuration (`config.py` / `.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_BASE_URL` | `http://localhost:11434/v1` | OpenAI-compatible LLM endpoint |
| `LLM_MODEL` | `llama3.2:latest` | Model name |
| `LLM_API_KEY` | `ollama` | API key (ignored by Ollama) |
| `API_PORT` | `8000` | Backend listen port |
| `ENABLE_SERVER_AUDIO` | `false` | Enable Kokoro TTS |
| `ADMIN_API_KEY` | `secret_dev_key` | Key for `/v1/reload` |
| `MENU_PATH` | `data/menu.json` | Menu data file |
| `FACTS_PATH` | `data/facts.json` | Facts data file |
