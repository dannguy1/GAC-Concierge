import asyncio
import logging
import random
from typing import List, Dict, Any

import config

logger = logging.getLogger("gac_waiter.display_agent")

_display_agent_instance = None


def get_display_agent() -> "DisplayAgent":
    global _display_agent_instance
    if _display_agent_instance is None:
        _display_agent_instance = DisplayAgent()
    return _display_agent_instance


class DisplayAgent:
    """
    Autonomous agent that periodically selects menu items and broadcasts
    display events to all connected SSE clients via a shared asyncio.Queue.

    Selection logic can be extended in _pick_items(). Initially picks
    DISPLAY_ITEMS_PER_EVENT random popular items, falling back to any items
    if there are not enough popular ones.
    """

    def __init__(self):
        self.interval = config.DISPLAY_INTERVAL
        self.items_per_event = config.DISPLAY_ITEMS_PER_EVENT
        # Shared broadcast queue — api.py subscribers read from this
        self.queue: asyncio.Queue = asyncio.Queue()
        self._menu_items: List[Dict[str, Any]] = []
        logger.info(
            f"DisplayAgent initialized — interval={self.interval}s, "
            f"items_per_event={self.items_per_event}"
        )

    def load_menu(self, items: List[Dict[str, Any]]):
        """Called at startup (and on reload) to provide the current menu list."""
        self._menu_items = [i for i in items if i.get("type") != "general_info"]
        logger.info(f"DisplayAgent loaded {len(self._menu_items)} menu items")

    def _pick_items(self) -> List[Dict[str, Any]]:
        """
        Select items to display. Current logic: prefer popular items;
        fall back to the full menu if not enough popular items exist.
        Extend this method for time-of-day specials, LLM-driven picks, etc.
        """
        if not self._menu_items:
            return []

        popular = [i for i in self._menu_items if i.get("popular")]
        pool = popular if len(popular) >= self.items_per_event else self._menu_items
        count = min(self.items_per_event, len(pool))
        return random.sample(pool, count)

    async def run(self):
        """
        Async loop: pick items and push to broadcast queue every `interval` seconds.
        Runs as a FastAPI lifespan background task.
        """
        logger.info("DisplayAgent background loop started")
        while True:
            try:
                items = self._pick_items()
                if items:
                    await self.queue.put({"items": items})
                    logger.debug(f"DisplayAgent pushed {len(items)} items to queue")
            except Exception as e:
                logger.error(f"DisplayAgent error picking items: {e}")
            await asyncio.sleep(self.interval)
