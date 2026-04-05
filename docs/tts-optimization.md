# Voice Playback Optimization

## Problem Statement

The "Play Voice" button in the chat interface has noticeable latency — typically
2–6 seconds before audio starts. This is caused by Kokoro TTS synthesis running
synchronously on the CPU **only after** the user clicks the button, even though
the assistant's reply has been visible on screen for several seconds already.

The disk cache already eliminates latency on repeat plays of the same message
(~60 ms). The problem is exclusively the **first play** of each new message.

---

## Current Architecture

### Flow (on each "Play Voice" click)

```
User clicks "Play Voice"
  │
  ▼
POST /v1/tts  {text, language}
  │
  ▼ backend/tts_client.py
  ├─ _strip_markdown(text)         ~1 ms   (15 regex ops)
  ├─ _normalize_lang_name()        ~0 ms
  ├─ _detect_language()            ~5 ms   (langdetect)
  ├─ filesystem cache lookup       ~2 ms
  │
  ├─ [CACHE HIT]  read .wav file   ~10 ms  → base64 encode → return   ~60 ms total
  │
  └─ [CACHE MISS]
       ├─ KPipeline inference      2–6 s   ← BOTTLENECK
       ├─ np.concatenate chunks    ~5 ms
       ├─ soundfile.write WAV      ~15 ms
       ├─ cache write to disk      ~5 ms
       └─ base64 encode + return   ~10 ms
  │
  ▼ frontend
  ├─ atob() decode base64          ~10 ms
  ├─ AudioContext.decodeAudioData  ~15 ms  (web)
  │  Audio.Sound.createAsync       ~20 ms  (mobile)
  └─ source.start() / shouldPlay   0 ms
```

### Latency Breakdown (first play, typical 100-word message)

| Stage | Location | Cost |
|-------|----------|------|
| Network request (LAN) | client → server | ~5 ms |
| Markdown strip | backend | ~1 ms |
| Language detection | backend | ~5 ms |
| Filesystem cache check | backend | ~2 ms |
| **Kokoro CPU inference** | **backend** | **2,000–6,000 ms** |
| WAV encoding (soundfile) | backend | ~15 ms |
| Cache write | backend | ~5 ms |
| Base64 encoding | backend | ~10 ms |
| Network response (LAN) | server → client | ~5 ms |
| Audio decode + play | client | ~20 ms |
| **Total — first play** | | **~2–6 seconds** |
| **Total — cache hit** | | **~60 ms** |

### Payload Size

Kokoro outputs 24 kHz mono WAV. Typical assistant messages produce:

| Message length | WAV size | Base64 size |
|----------------|----------|-------------|
| Short (~30 words) | ~200 KB | ~267 KB |
| Medium (~100 words) | ~600 KB | ~800 KB |
| Long (~250 words) | 1.5–3 MB | 2–4 MB |

Base64 encoding adds ~33% overhead. All data is transferred on the LAN before
any audio plays.

### Key Code Locations

| File | Role |
|------|------|
| `backend/tts_client.py` | `generate_audio()` — Kokoro pipeline, disk cache |
| `backend/api.py:218` | `POST /v1/tts` — synchronous, blocks until full WAV ready |
| `frontend/src/components/ChatInterface.jsx:20` | `playTTS()` — Web Audio API decode + play |
| `frontend/src/services/api.js:44` | `fetchTTS()` — POST /v1/tts |
| `mobile/components/ChatInterface.js:42` | `playTTS()` — expo-av decode + play |
| `mobile/services/api.js:74` | `fetchTTS()` — POST /v1/tts |
| `cache/tts/` | Disk cache — MD5-keyed `.wav` files |

### Cache Key

```python
cache_key = self._get_cache_key(f"{detected_lang}:{voice}:{text}")
# → MD5 of that string (lowercase stripped)
```

The key includes the original (pre-cleaned) text, language code, and voice name.
Any prefetch must use the **same language parameter** to produce a matching key.

---

## Root Cause

The synthesis only starts when the user clicks the button. However, the assistant
message typically sits on screen for 5–30 seconds while the user reads it. That
idle time is wasted — synthesis could have been running the whole time.

The endpoint is also **fully synchronous**: `api.py:231` collects all Kokoro
output chunks before returning any bytes, so the client receives nothing until
synthesis of the *entire* message is complete.

---

## Proposed Optimizations

Three independent phases, each delivering value on its own.

---

### Phase 1 — Speculative Prefetch

**Concept**: Immediately after the assistant reply arrives on the client,
fire a **background HTTP request** to a new `/v1/tts/prefetch` endpoint.
The backend starts Kokoro synthesis in a **daemon thread** and returns `202
Accepted` instantly. By the time the user finishes reading and clicks "Play
Voice" (typically 5–30 s later), the WAV is already in the disk cache.
The regular `/v1/tts` call then becomes a cache hit (~60 ms).

**Expected latency after change**: ~60 ms (same as repeat plays today).

#### Backend Changes

**`backend/tts_client.py`** — Extract synthesis into a reusable helper:

```python
def _synthesize_and_cache(self, text: str, language: str = None):
    """Run Kokoro synthesis and write result to disk cache. Thread-safe."""
    clean_text = self._strip_markdown(text)
    if not clean_text:
        return

    explicit_lang = self._normalize_lang_name(language)
    detected_lang = explicit_lang if explicit_lang else self._detect_language(clean_text)
    k_lang = self._map_lang_to_kokoro(detected_lang)
    voice = self.voices.get(detected_lang, self.voices['en'])

    cache_key = self._get_cache_key(f"{detected_lang}:{voice}:{text}")
    cache_path = self._get_cache_path(cache_key)

    if os.path.exists(cache_path):
        return  # Already cached — nothing to do

    try:
        pipeline = self._get_pipeline(k_lang)
        import soundfile as sf
        import numpy as np

        generator = pipeline(clean_text, voice=voice, speed=1, split_pattern=r'\n+')
        chunks = [audio for _, _, audio in generator if audio is not None]
        if not chunks:
            return

        full_audio = np.concatenate(chunks)
        buf = io.BytesIO()
        sf.write(buf, full_audio, config.TTS_SAMPLE_RATE, format='WAV')
        with open(cache_path, 'wb') as f:
            f.write(buf.getvalue())
        logger.debug(f"Prefetch cached: {cache_path}")
    except Exception as e:
        logger.warning(f"Prefetch synthesis failed: {e}")
```

**`backend/api.py`** — Add prefetch endpoint:

```python
import threading

@app.post("/v1/tts/prefetch", status_code=202)
def tts_prefetch_endpoint(request: dict = Body(...)):
    """
    Fire-and-forget TTS synthesis. Warms the disk cache in a background thread.
    Returns 202 immediately; the client does not need to wait for a response.
    """
    if not config.ENABLE_SERVER_AUDIO:
        return {"status": "disabled"}
    text = request.get("text", "")
    language = request.get("language", "")
    if not text:
        return {"status": "no_text"}

    t = threading.Thread(
        target=tts_client._synthesize_and_cache,
        args=(text, language),
        daemon=True
    )
    t.start()
    return {"status": "queued"}
```

#### Frontend Changes (Web)

**`frontend/src/services/api.js`**:

```javascript
export const prefetchTTS = (text, language) => {
    // Fire-and-forget — no await, no error handling needed
    fetch(`${API_BASE_URL}/tts/prefetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language }),
    }).catch(() => {}); // Silently ignore errors
};
```

**`frontend/src/App.jsx`** — Call after assistant message received:

```javascript
import { sendChat, prefetchTTS } from './services/api';

// Inside handleSendMessage, after setMessages():
setMessages([...newMessages, { role: 'assistant', content: data.text, language: data.language }]);

// Warm the TTS cache while the user reads the response
if (data.text) {
    prefetchTTS(data.text, data.language || language);
}
```

#### Frontend Changes (Mobile)

**`mobile/services/api.js`**:

```javascript
export const prefetchTTS = (text, language) => {
    fetch(`${baseUrl()}/tts/prefetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language }),
    }).catch(() => {});
};
```

**`mobile/App.js`** — Same pattern after assistant message:

```javascript
import { sendChat, prefetchTTS } from './services/api';

// After receiving assistant reply:
if (data.text) {
    prefetchTTS(data.text, data.language || currentLanguage);
}
```

#### Considerations

- **CPU contention**: Prefetch synthesis runs concurrently with the LLM still
  potentially processing the next user turn. On a 30 GB RAM server with CPU
  inference, this is acceptable — Kokoro and the LLM client use different CPU
  threads. If contention becomes a problem, add a `threading.Semaphore(1)` to
  queue prefetch jobs.
- **Wasted work**: If a user never clicks "Play Voice", the synthesis runs for
  nothing. This is acceptable for a LAN restaurant app where TTS is a primary
  feature and CPU is not a shared resource.
- **Language mismatch**: The prefetch must use `data.language` (the language
  the agent detected/set), not the UI `language` state, to ensure the cache key
  matches what `/v1/tts` will compute.
- **Cache growth**: Each unique message gets one WAV file. At ~600 KB per
  message and ~50 messages per session, a session adds ~30 MB to `cache/tts/`.
  Consider adding a cache size cap or TTL cleanup job.

---

### Phase 2 — Sentence-Level Streaming

**Concept**: Instead of waiting for the entire response to be synthesized,
stream sentence-by-sentence. The user hears the first sentence (~0.5–1 s)
while the remaining sentences synthesize in parallel. Total perceived latency
drops to "first sentence synthesis time" regardless of message length.

**Expected first-audio latency**: ~0.5–1.5 s for first sentence.

#### Backend Changes

```python
from fastapi.responses import StreamingResponse
import struct

def _wav_header(sample_rate: int, num_samples: int) -> bytes:
    """Build a minimal WAV header for a mono 32-bit float PCM stream."""
    data_size = num_samples * 4  # float32
    return struct.pack('<4sI4s4sIHHIIHH4sI',
        b'RIFF', 36 + data_size, b'WAVE', b'fmt ', 16,
        3, 1, sample_rate, sample_rate * 4, 4, 32, b'data', data_size)

@app.post("/v1/tts/stream")
def tts_stream_endpoint(request: dict = Body(...)):
    """Stream WAV audio sentence by sentence."""
    text = request.get("text", "")
    language = request.get("language", "")
    if not config.ENABLE_SERVER_AUDIO or not text:
        raise HTTPException(status_code=400)

    def generate():
        # Uses existing tts_client._synthesize_and_cache logic but yields chunks
        clean_text = tts_client._strip_markdown(text)
        explicit_lang = tts_client._normalize_lang_name(language)
        detected_lang = explicit_lang or tts_client._detect_language(clean_text)
        k_lang = tts_client._map_lang_to_kokoro(detected_lang)
        voice = tts_client.voices.get(detected_lang, tts_client.voices['en'])
        pipeline = tts_client._get_pipeline(k_lang)
        for _, _, audio in pipeline(clean_text, voice=voice, speed=1, split_pattern=r'\n+'):
            if audio is not None:
                yield audio.astype('float32').tobytes()

    return StreamingResponse(generate(), media_type="audio/pcm")
```

#### Web Frontend Changes

Uses the Web Audio API's `AudioWorklet` or `MediaSource` to play PCM chunks
as they arrive:

```javascript
const playTTSStreaming = async (text, language) => {
    const audioCtx = new AudioContext({ sampleRate: 24000 });
    const response = await fetch(`${API_BASE_URL}/tts/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language }),
    });

    const reader = response.body.getReader();
    let startTime = audioCtx.currentTime;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // value is Float32 PCM bytes for one sentence
        const floats = new Float32Array(value.buffer);
        const buffer = audioCtx.createBuffer(1, floats.length, 24000);
        buffer.copyToChannel(floats, 0);
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.start(startTime);
        startTime += buffer.duration;
    }
};
```

#### Mobile Frontend Changes

Expo AV does not support PCM streaming natively. Approach: collect chunks,
build a WAV in memory, play when first chunk arrives:

```javascript
// Collect sentence WAVs from server, play each sequentially
const playTTSStreaming = async (text, language) => {
    // Alternative: use regular /v1/tts with prefetch (Phase 1) — simpler on mobile
};
```

> **Note**: Streaming is most impactful on **web**. For mobile, Phase 1
> (prefetch) is likely sufficient since expo-av handles base64 WAV efficiently.

#### Considerations

- Requires client support for `ReadableStream` (all modern browsers).
- WAV headers need careful handling — either send raw PCM (simpler) or build
  proper per-chunk headers.
- The `/v1/tts` endpoint can remain unchanged; streaming is additive via a
  separate `/v1/tts/stream` endpoint.
- Disk cache cannot be used for streaming responses. Phase 1 and Phase 2 are
  complementary: Phase 1 handles cache warmup; Phase 2 handles the first play
  before the cache is warm.

---

### Phase 3 — Browser / System TTS Fallback

**Concept**: Add a second "⚡ Quick Voice" button that uses the device's
built-in speech synthesis. Zero server round-trip, zero synthesis delay.
Voice quality is lower (browser/OS TTS) but playback is instant.

**Expected latency**: < 100 ms (browser TTS starts immediately).

#### Web

```javascript
const playBrowserTTS = (text, language) => {
    const langMap = {
        'English': 'en-US', 'Spanish': 'es-ES', 'Vietnamese': 'vi-VN',
        'Mandarin Chinese': 'zh-CN', 'French': 'fr-FR', 'Italian': 'it-IT',
        'Portuguese': 'pt-BR', 'Hindi': 'hi-IN', 'Japanese': 'ja-JP',
    };
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = langMap[language] || 'en-US';
    utt.rate = 1.0;
    window.speechSynthesis.speak(utt);
};
```

#### Mobile

```javascript
import * as Speech from 'expo-speech';

const playSystemTTS = (text, language) => {
    const langMap = { 'English': 'en', 'Spanish': 'es', 'Vietnamese': 'vi', ... };
    Speech.speak(text, { language: langMap[language] || 'en', rate: 1.0 });
};
```

#### UI Integration

Show both options in the message bubble:

```
▶ Play Voice   ⚡ Quick
```

- "Play Voice" = Kokoro (high quality, takes ~60 ms after prefetch warmup)
- "Quick" = Browser/System TTS (instant, lower quality)

#### Considerations

- `window.speechSynthesis` quality varies widely by browser and OS.
- Vietnamese voice availability in browser TTS is inconsistent.
- `expo-speech` is already in the Expo SDK; no new package needed for mobile.
- Web Speech API does not require `ENABLE_SERVER_AUDIO=true`.

---

## Implementation Priority

| Phase | Effort | Perceived Latency Improvement | Recommended |
|-------|--------|-------------------------------|-------------|
| 1 — Speculative Prefetch | ~2 h | 2–6 s → ~60 ms (for reads ≥ synthesis time) | ✅ Start here |
| 2 — Streaming | ~1 day | First audio in ~1 s regardless of message length | Later |
| 3 — Browser TTS Fallback | ~1 h | Instant (lower quality) | Optional |

Phase 1 alone eliminates the bottleneck for the normal usage pattern (user reads,
then clicks). Implement Phase 1, measure in production, then revisit Phases 2–3.

---

## Files Affected (Phase 1)

| File | Change |
|------|--------|
| `backend/tts_client.py` | Add `_synthesize_and_cache()` helper method |
| `backend/api.py` | Add `POST /v1/tts/prefetch` endpoint |
| `frontend/src/services/api.js` | Add `prefetchTTS()` function |
| `frontend/src/App.jsx` | Call `prefetchTTS()` after assistant message |
| `mobile/services/api.js` | Add `prefetchTTS()` function |
| `mobile/App.js` | Call `prefetchTTS()` after assistant message |

## Files Affected (Phase 2, additive)

| File | Change |
|------|--------|
| `backend/tts_client.py` | Expose `_strip_markdown`, `_normalize_lang_name`, etc. as public helpers |
| `backend/api.py` | Add `POST /v1/tts/stream` returning `StreamingResponse` |
| `frontend/src/services/api.js` | Add `streamTTS()` using Fetch ReadableStream |
| `frontend/src/components/ChatInterface.jsx` | Add streaming playback path |

## Files Affected (Phase 3, additive)

| File | Change |
|------|--------|
| `frontend/src/components/ChatInterface.jsx` | Add "⚡ Quick Voice" button |
| `mobile/components/ChatInterface.js` | Add "⚡ Quick Voice" button using expo-speech |
