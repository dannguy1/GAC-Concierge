# Web Frontend Design

## Stack

- **React 18** with functional components and hooks
- **Vite 8** dev server (port 8501, `host: true` for LAN access)
- **Vanilla CSS** — no Tailwind, no CSS-in-JS; CSS variables for theming
- No TypeScript — plain JSX

## Directory Structure

```
frontend/
├── src/
│   ├── App.jsx                 Root component — all shared state
│   ├── App.css                 Global styles and CSS variables
│   ├── main.jsx                React entry point
│   ├── services/
│   │   └── api.js              All fetch() calls — single API boundary
│   └── components/
│       ├── ChatInterface.jsx   Message thread, language picker, input
│       ├── MenuVisualizer.jsx  Menu card grid with category tabs
│       ├── MenuCard.jsx        Single menu item card with image
│       ├── CategoryFilter.jsx  Horizontal scrolling category tab bar
│       ├── OrderPad.jsx        Slide-in order drawer (receipt style)
│       ├── ItemDetailModal.jsx Full-screen item detail overlay
│       └── TableSetupModal.jsx Table number + guest count dialog
├── vite.config.js              Port 8501, proxy /v1 → :8000
└── package.json
```

## State Architecture (`App.jsx`)

All application state lives in `App.jsx`. Components are stateless/controlled.

| State | Type | Purpose |
|-------|------|---------|
| `messages` | `Array` | Full conversation history (includes hidden system events) |
| `cart` | `Array` | Current order items `{item_name, name, qty, notes, price}` |
| `mentionedItems` | `Array` | Menu items referenced by agent in last reply |
| `generalNotes` | `string` | Order-level note (allergies, preferences) |
| `orderConfirmed` | `boolean` | True after agent calls `confirm_order`; reset to `false` when user manually modifies cart |
| `isLoading` | `boolean` | True while LLM request in flight |
| `thinkingSeconds` | `number` | Elapsed seconds during LLM wait |
| `language` | `string` | Selected UI/response language |
| `allMenuItems` | `Array` | Full menu loaded from `/v1/menu` on mount |
| `categories` | `Array` | Sorted list of category names |
| `activeCategory` | `string` | Selected category tab (`"Suggested"` or category name) |
| `selectedItem` | `object\|null` | Item open in detail modal |
| `tableNumber` | `string` | Set via TableSetupModal |
| `guestCount` | `number` | Set via TableSetupModal |
| `isOrderPadOpen` | `boolean` | Controls OrderPad drawer visibility |
| `showTableSetup` | `boolean` | Controls TableSetupModal visibility |
| `menuError` | `boolean` | True if menu fetch fails |

## Layout

Three-panel layout rendered side-by-side via CSS (`app-container` flex row):

```
┌──────────────────┬──────────────────────┬─────────────────┐
│  ChatInterface   │   MenuVisualizer     │   OrderPad      │
│  (left panel)    │   (center panel)     │  (slide-in)     │
│                  │                      │                  │
│  Language picker │  Category tabs       │  Receipt header  │
│  Message thread  │  Card grid           │  Cart items      │
│  Input bar       │  Item images         │  Subtotal        │
│                  │                      │  Send to Kitchen │
└──────────────────┴──────────────────────┴─────────────────┘
                                     ▲
                         "🪑 Set Table" badge
                         "📋 Review Order" button
                         (fixed bottom-right)
```

The `OrderPad` slides in as an overlay when the "Review Order" button is clicked.

## API Boundary (`services/api.js`)

All `fetch()` calls are in `api.js`. Components never call `fetch()` directly.

```javascript
fetchMenu()          // GET  /v1/menu  (15s timeout)
sendChat(messages, language, signal)  // POST /v1/chat
sendCheckout(cart, generalNotes)      // POST /v1/checkout
fetchTTS(text, language)              // POST /v1/tts
getImageUrl(imagePath)                // Constructs image URL (no fetch)
```

`App.jsx` applies a **90-second hard timeout** to every chat request via `AbortController`. A thinking counter in the UI shows elapsed time; a "Cancel" button appears at 20 seconds.

`getImageUrl()` normalises image paths from menu items: strips `./` prefix, converts `data/images/` → `images/`, and returns `null` for any path containing `..` (directory traversal guard).

Vite proxies `/v1/*`, `/images/*`, `/downloaded_images/*` to `http://127.0.0.1:8000`.

## Silent System Events

Cart and table actions inject hidden messages into the conversation so the LLM maintains context without the user seeing them:

```javascript
// Sent as role: 'user', hidden: true — never shown in UI
"[System Event] User explicitly clicked a button to add 1x Pho Tai to their order cart."
"[System Event] Table setup: Table 5, 4 guests."
```

The `ChatInterface` filters hidden messages: `messages.filter(m => !m.hidden)`.

## Cart Item Shape

```javascript
{
    item_name: "Pho Tai",   // sent to /v1/checkout
    name:      "Pho Tai",   // used for UI display and qty updates
    qty:       2,
    notes:     "no onions",
    price:     12.95        // display only; server re-validates on checkout
}
```

## TTS Playback (Web)

`ChatInterface.jsx` uses the Web Audio API:

1. `playTTS()` is called from a click handler (required for browser autoplay policy)
2. Creates `AudioContext` synchronously inside the handler
3. Awaits `fetchTTS()` to get base64 WAV
4. Decodes with `audioCtx.decodeAudioData()`
5. Creates `BufferSource`, plays, closes context on `onended`
6. `playingIdx` state prevents concurrent playback

## Table Setup

The `🪑 Set Table` button (bottom-right, above "Review Order") opens `TableSetupModal`:
- Table number: free-text input (e.g., "5", "B3")
- Guest count: stepper (1–20)
- On save: injects system event into chat, updates `tableNumber`/`guestCount` state
- `OrderPad` displays table/guest in the receipt header

## Language Support

Nine languages selectable via dropdown in the chat panel header:

| Option | Value |
|--------|-------|
| 🇬🇧/🇺🇸 English | `English` |
| 🇪🇸 Spanish | `Spanish` |
| 🇻🇳 Vietnamese | `Vietnamese` |
| 🇨🇳 Chinese | `Mandarin Chinese` |
| 🇫🇷 French | `French` |
| 🇮🇹 Italian | `Italian` |
| 🇧🇷 Portuguese | `Portuguese` |
| 🇮🇳 Hindi | `Hindi` |
| 🇯🇵 Japanese | `Japanese` |

Language is passed in every `/v1/chat` request. The agent's `set_language` tool can also change it mid-conversation.

## CSS Variables (Theming)

Defined in `App.css`:

```css
--color-brand-green:      #5a7a3a
--color-brand-green-dark: #4a6a2a
--color-brand-gold:       #c8a84b
--color-bg-paper:         #faf8f2
--color-card-bg:          #ffffff
--color-border:           #e0d8c8
--color-text-main:        #2c2c2c
--color-text-muted:       #888888
--font-serif:             Georgia, serif
--radius-md:              12px
--shadow-sm:              0 1px 4px rgba(0,0,0,0.08)
```

## Vite Dev Server

```javascript
// vite.config.js
server: {
    port: 8501,
    strictPort: true,
    host: true,          // binds to 0.0.0.0 for LAN access
    proxy: {
        '/v1':                  'http://127.0.0.1:8000',
        '/images':              'http://127.0.0.1:8000',
        '/downloaded_images':   'http://127.0.0.1:8000',
    }
}
```

The Vite process is wrapped in a restart loop in `gac_service.sh` to auto-recover from `ECONNRESET` crashes caused by dropped browser connections.
