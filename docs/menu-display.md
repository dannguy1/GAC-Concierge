# menu-display

A lightweight, browser-based kiosk app that renders menu items pushed by the backend `display-agent`. Designed to run on any low-power device (Raspberry Pi, tablet, TV stick) using a standard web browser.

## Architecture

```
DisplayAgent (backend asyncio loop)
    → asyncio.Queue (broadcast)
    → Fan-out task (one copy per SSE client)
    → GET /v1/display/stream  (SSE endpoint)
    → EventSource (browser)
    → menu-display App.jsx
    → DisplayCard component (full-screen item card)
```

- **Transport:** Server-Sent Events (SSE) — server pushes, no WebSocket complexity, auto-reconnects natively
- **Rendering:** Full-screen item cards with fade-in animation, cycling through items every 8 seconds
- **Decoupled:** Zero dependency on chat, cart, or order state

## Running

### With the service manager (recommended)

```bash
./gac_service.sh start    # starts backend + frontend + display
./gac_service.sh stop
./gac_service.sh status
```

Logs: `display.log`

### Manually (dev)

```bash
# Backend must be running first
cd menu-display
npm install   # first time only
npm run dev   # serves on http://localhost:8502
```

## Raspberry Pi Kiosk Setup

1. Install Chromium: `sudo apt install chromium-browser`
2. Set up auto-start (e.g. in `/etc/xdg/autostart/kiosk.desktop` or via `~/.config/lxsession/LXDE-pi/autostart`):

```
@chromium-browser --kiosk --noerrdialogs --disable-infobars \
  --check-for-update-interval=31536000 \
  http://gacaiserver:8502
```

3. Disable screen blanking:
```bash
# Add to /etc/rc.local or autostart
xset s off
xset -dpms
xset s noblank
```

The display auto-reconnects if the server restarts — no action needed on the Pi.

## Configuration (.env)

| Variable | Default | Description |
|---|---|---|
| `DISPLAY_INTERVAL` | `30` | Seconds between display events |
| `DISPLAY_ITEMS_PER_EVENT` | `3` | Number of items sent per event |
| `DISPLAY_PORT` | `8502` | Port for the menu-display Vite app |

## Extending the Display Agent

Item selection logic lives in `backend/display_agent.py` → `_pick_items()`.

Currently: picks `DISPLAY_ITEMS_PER_EVENT` random popular items.

To extend (examples):
- **Time-of-day specials:** Check `datetime.now().hour` and filter by category
- **LLM-driven picks:** Call the LLM with menu context to select contextually relevant items
- **React to chat:** Listen to a shared event bus and push items mentioned in recent conversations

## SSE Event Format

Each event is a JSON payload:

```json
{
  "items": [
    {
      "item_name": "Egg rolls",
      "description": "Crispy Vietnamese spring rolls...",
      "image_path": "./downloaded_images/Egg_Rolls.jpg",
      "price": 30.0,
      "category": "Appetizers",
      "popular": true,
      "item_viet": "Chả Giò",
      "description_viet": "..."
    }
  ]
}
```

Items are the same shape as `mentioned_items` in the chat API.
