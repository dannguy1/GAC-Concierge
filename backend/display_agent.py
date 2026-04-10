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

    Cycling strategy: all menu items are shuffled into a deck. Batches are
    dealt from the front of the deck — no item repeats until every item has
    been shown once. When the deck is exhausted it is reshuffled for the next
    cycle, ensuring complete, fair coverage of the entire menu.
    """

    def __init__(self):
        self.interval = config.DISPLAY_INTERVAL
        self.items_per_event = config.DISPLAY_ITEMS_PER_EVENT
        self.item_interval = config.DISPLAY_ITEM_INTERVAL
        # Shared broadcast queue — api.py subscribers read from this
        self.queue: asyncio.Queue = asyncio.Queue()
        self._menu_items: List[Dict[str, Any]] = []
        self._deck: List[Dict[str, Any]] = []   # shuffled queue; refilled each cycle
        logger.info(
            f"DisplayAgent initialized — interval={self.interval}s, "
            f"items_per_event={self.items_per_event}, "
            f"item_interval={self.item_interval}s"
        )

    def load_menu(self, items: List[Dict[str, Any]]):
        """Called at startup (and on reload) to provide the current menu list.
        Resets the deck so the new menu takes effect on the next batch."""
        self._menu_items = [i for i in items if i.get("type") != "general_info"]
        self._deck = []   # force a reshuffle on next pick
        logger.info(f"DisplayAgent loaded {len(self._menu_items)} menu items")

    def _refill_deck(self):
        """Shuffle all menu items into a fresh deck for a new display cycle."""
        self._deck = list(self._menu_items)
        random.shuffle(self._deck)
        logger.info(
            f"DisplayAgent starting new display cycle — {len(self._deck)} items in deck"
        )

    def _pick_items(self) -> List[Dict[str, Any]]:
        """
        Deal the next batch from the shuffled deck.
        Once the deck is empty every item has been shown exactly once;
        the deck is reshuffled to begin the next cycle.
        """
        if not self._menu_items:
            return []

        if not self._deck:
            self._refill_deck()

        batch = self._deck[: self.items_per_event]
        self._deck = self._deck[self.items_per_event :]
        return batch

    async def run(self):
        """
        Async loop: pick items and push to broadcast queue every `interval` seconds.
        Runs as a FastAPI lifespan background task.

        Each event envelope shape:
        {
            "display": {
                "item_interval": <int seconds>   # how long to show each item
                # future fields: transition, shuffle, loop, …
            },
            "items": [ <menu item dict>, … ]
        }
        """
        logger.info("DisplayAgent background loop started")
        while True:
            try:
                items = self._pick_items()
                if items:
                    event = {
                        "display": {
                            "item_interval": self.item_interval,
                        },
                        "items": items,
                    }
                    await self.queue.put(event)
                    logger.debug(f"DisplayAgent pushed {len(items)} items to queue")
            except Exception as e:
                logger.error(f"DisplayAgent error picking items: {e}")
            await asyncio.sleep(self.interval)
