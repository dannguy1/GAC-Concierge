import json
import logging
import config
import random

# Configure logging
logger = logging.getLogger("gac_waiter.menu")

class MenuManager:
    def __init__(self):
        self.menu_data = self._load_menu()
        self.items = self.menu_data.get("items", [])
        
    def _load_menu(self):
        try:
            with open(config.MENU_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading menu: {e}")
            return {"items": []}
            
    def reload(self):
        """Reloads menu data from disk."""
        logger.info("Reloading MenuManager...")
        self.menu_data = self._load_menu()
        self.items = self.menu_data.get("items", [])
        logger.info(f"MenuManager reloaded with {len(self.items)} items.")
        
    def get_full_menu_context(self):
        """
        Returns a structured string of the menu by category.
        """
        context = []
        
        # Group by Category
        categories = {}
        for item in self.items:
            cat = item.get('category', 'Others')
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(item)
            
        for cat, items in categories.items():
            context.append(f"\n--- {cat.upper()} ---")
            for item in items:
                pop_str = " [POPULAR]" if item.get('popular') else ""
                item_str = f"- {item.get('item_name')} (${item.get('price')}){pop_str}: {item.get('description')}"
                context.append(item_str)
                
        return "\n".join(context)


    def find_items_in_text(self, text):
        """
        Simple keyword matching to find items mentioned in text.
        Returns a list of item dicts.
        """
        found_items = []
        text_lower = text.lower()
        
        # Sort by length descending to match longer names first
        sorted_items = sorted(self.items, key=lambda x: len(x.get('item_name', '')), reverse=True)
        
        for item in sorted_items:
            name = item.get('item_name', '')
            if name and name.lower() in text_lower:
                found_items.append(item)
                
        return found_items

    def get_random_upsell(self):
        """Returns a random item as a suggestion."""
        if not self.items:
            return {}
        return random.choice(self.items)
