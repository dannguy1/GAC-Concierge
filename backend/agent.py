import json
import re
import logging
import config
from openai import OpenAI
from backend.rag_retriever import get_retriever

# Configure logging
logger = logging.getLogger("gac_waiter.agent")


def clean_llm_response(text: str) -> str:
    """Remove LLM thinking tags and cleanup the response."""
    if not text:
        return text
    
    # Remove <think>...</think> blocks (including multiline)
    text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL)
    
    # Remove any remaining opening/closing tags
    text = re.sub(r'</?think>', '', text)
    
    # Clean up extra whitespace resulting from removal
    text = re.sub(r'\n\s*\n', '\n\n', text)
    
    return text.strip()

# Import menu_manager singleton
from backend.menu_manager import MenuManager
menu_manager = MenuManager()

class WaitstaffAgent:
    def __init__(self):
        self.retriever = get_retriever()
        self.menu_manager = menu_manager
        self.client = OpenAI(
            base_url=config.LLM_BASE_URL,
            api_key=config.LLM_API_KEY,
            timeout=180.0  # 3 minute timeout for slow CPU inference
        )
        self.model = config.LLM_MODEL
        logger.info(f"Agent initialized with model: {self.model}")
        self.last_mentioned_items = []


    def lookup_menu(self, query: str, language: str = "English") -> str:
        """Search for items in the menu."""
        items = self.retriever.retrieve_items(query, top_k=3)
# Note: Filter for menu_items only? The retriever currently mixes them but marks type.
# For specific menu lookup, we might want to prioritize 'menu_item'.
        if not items:
            return "No menu items found matching that query."
        
        # Track found items for the UI
        self.last_mentioned_items.extend([i for i in items if i.get('type') != 'general_info'])
        
        result = "Found Menu Items:\n"
        for item in items:
            if item.get('type') == 'general_info': continue # Skip regular info for menu lookup
            
            # Show Vietnamese name first when in Vietnamese mode
            if language.lower() == "vietnamese" and item.get('item_viet'):
                result += f"- {item.get('item_viet')} (${item.get('price', 0):.2f})\n"
                result += f"  EN: {item.get('item_name')}\n"
                if item.get('pronunciation'):
                    result += f"  Phát âm: {item.get('pronunciation')}\n"
            else:
                result += f"- {item.get('item_name')} (${item.get('price', 0):.2f})\n"
            
            if item.get('popular'):
                result += "  [PHỔ BIẾN]\n" if language.lower() == "vietnamese" else "  [POPULAR]\n"
            result += f"  Mô tả: {item.get('description', '')}\n" if language.lower() == "vietnamese" else f"  Desc: {item.get('description', '')}\n"
        
        result += "\n[SYSTEM WARNING: You must ONLY talk about these specific items. Do not invent others. If these are not what the user asked for, apologize and say you couldn't find exact matches.]"
        return result

    def lookup_info(self, query: str) -> str:
        """Search for general restaurant info (owner, history, location, etc)."""
        items = self.retriever.retrieve_items(query, top_k=3)
        
        if not items:
            return "No specific info found."
            
        result = "Found Information:\n"
        for item in items:
            # We accept both types here as menu items might be relevant to info (e.g. signature dishes)
            name = item.get('item_name') or item.get('topic')
            content = item.get('content') or item.get('description')
            result += f"- {name}: {content}\n"
        return result

    def run(self, messages: list, current_language: str = "English") -> dict:
        self.last_mentioned_items = [] # Reset for this turn
        current_cart_updates = [] # Track items added in this turn
        current_general_note = None
        order_confirmed_status = False
        """
        Run the ReAct loop to process the conversation.
        Returns: { "text": str, "language": str, "cart_updates": list }
        """
        # 1. Prepare Tools and System Prompt
        tools_desc = """
1. lookup_menu(query: str): Search for dishes, prices, ingredients. usage: Action: lookup_menu\nAction Input: query
2. lookup_info(query: str): Search for owner, location, history, policies. usage: Action: lookup_info\nAction Input: query
3. set_language(language: str): Set the current session language. usage: Action: set_language\nAction Input: language
4. add_to_cart(input: str): Add item to order. Input format: Use "Item Name, Quantity, Notes". The item name and notes MUST be in English for the kitchen. usage: Action: add_to_cart\nAction Input: Pho Tai, 2, no onions
5. set_general_note(note: str): Set special instructions for the ENTIRE order (e.g., allergies, global preferences). MUST be in English. usage: Action: set_general_note\nAction Input: Customer has peanut allergy
6. confirm_order(): Call this ONLY after the user has explicitly confirmed the order readback. usage: Action: confirm_order\nAction Input: confirmed
"""
        # Track the language state locally for this turn
        detected_language = current_language
        
        system_prompt = f"""You are Kristin, an intelligent waiter at Garlic & Chives.
You embody the classic "pencil and paper" waiter approach. You must:
1. Provide a professional introduction to the restaurant and its offerings.
2. Answer any questions the customer may have clearly and methodically.
3. Take precise notes of the order and any customer comments/allergies.
4. Provide a summary of the order and create a thorough order payload ready for the kitchen.

You have access to the following tools to answer customer questions accurately:

{tools_desc}

Current Language Preference: {current_language}. 
You MUST respond in this language ({current_language}) unless the user explicitly requests a switch using `set_language`.
If the language is Vietnamese, write purely in Vietnamese using the Latin alphabet (Quốc ngữ). DO NOT use Thai, Cyrillic, Chinese, or any other non-Latin scripts.
Methodically translate your thoughts to {current_language} before outputting.

PROTOCOL:
1. **SAFETY FIRST (ALLERGIES)**: 
   - Check if the user mentioned any allergy or dietary restriction (e.g., "I'm allergic to peanuts", "no spicy").
   - IF YES, you MUST call `set_general_note` **BEFORE** producing any text response.
   - **DO NOT** just say "I noted that". You must take the action.
   - Format:
     Action: set_general_note
     Action Input: User has [Allergy/preference]
2. Review the customer's input.
3. If the user asks to speak another language, use `set_language`.
4. If the customer asks for **specials (lunch, dinner, daily)**:
   - First, use `lookup_info` to find the written specials.
   - **CRITICAL**: If specific dishes are listed in the info (e.g., "Lemongrass Chicken"), you MUST then call `lookup_menu` for those specific items. This ensures the user sees the photos and prices in the "Suggested Items" panel.
5. If you need facts (prices, ingredients, owner name), use a tool. 
   - Output: 
     Action: [tool_name]
     Action Input: [query]
6. If you have enough info or it's just chit-chat, respond directly to the customer.
   - Output: [Final Answer]

ORDER WORKFLOW (CRITICAL - Follow this order):
1. **Exploration**: Help customers browse the menu, answer questions about dishes.
   - **CRITICAL**: ONLY recommend items that you have explicitly found using `lookup_menu`. Do not hallucinate dishes.
2. **Taking Orders**: When customer wants to add items (e.g., "I want pho", "add 2 egg rolls"):
   - You MUST call `add_to_cart`.
   - Format:
     Action: add_to_cart
     Action Input: Item Name, Qty, [Modifications ONLY: no onions, extra sauce]
   - **CRITICAL**: DO NOT put allergies or "no spicy" preferences here unless it's specific to just that dish. Use `set_general_note` for safety rules.
   - **UPSELL**: After a successful add, ALWAYS suggest a complementary Drink or Side Order if they haven't ordered one yet.
3. **SPECIAL NOTES & ALLERGIES**:
   - If user mentions allergies or global preferences (e.g., "Peanut Allergy", "Gluten Free", "No Spicy Food", "Separate Checks"):
   - You MUST call `set_general_note`.
   - Format:
     Action: set_general_note
     Action Input: User has peanut allergy
4. **Order Confirmation & Safety Check**:
   - When user is done ordering, you MUST:
     a. Explicitly ask: "Do you have any food allergies?" (If not already discussed).
     b. Perform a full **Order Readback**: "Confirmed: [List Items]. Total approx $X. Global Notes: [Notes]. Is this correct?"
5. **Finalization**:
   - ONLY after the user says "Yes/Correct" to the readback:
   - Call the `confirm_order` tool to unlock the checkout button.
   - Format:
     Action: confirm_order
     Action Input: confirmed
   - Say: "Great! I've confirmed your order. You can now press the Submit Order button to send it to the kitchen."

CRITICAL RULES:
- NEVER hallucinate menu items or prices. ALWAYS verify with lookup_menu.
- **Verification Rule:** You are STRICTLY FORBIDDEN from mentioning any dish name that was not explicitly returned by the `lookup_menu` tool in the current turn.
- **KITCHEN LANGUAGE RULE:** While you may converse with the customer in any language they prefer, all `add_to_cart` and `set_general_note` tool calls MUST be written entirely in English. The kitchen only reads English. Use the 'EN:' name from lookup_menu results.
- If `lookup_menu` returns items, ensure they actually match the user's request. Do not claim an item is a "Lunch Special" just because it appeared in the search results.
- If no specific lunch specials are found in `lookup_info`, politely state that you can check the daily specials instead.
- **Only provide Vietnamese names and pronunciations if the current language is Vietnamese or if the user explicitly asks for them.** Do not volunteer this information in English conversation.
- **ALWAYS ask about allergies before confirming an order. This is a safety requirement.**
- Be concise and friendly.
- Do not expose the tool usage to the user in the final answer.
- **DO NOT write "Observation:" in your output.** The system will provide the observation after you specify Action and Action Input. Just output:
  Action: [tool_name]
  Action Input: [your input]
  Then STOP and wait. Do not continue with fake observations or assumed results.
- **DO NOT output raw JSON.** Respond in natural conversational language. If a tool returns data, summarize it for the user.
"""

        # Construct message history for LLM
        # We process the last user message to decide on action
        current_messages = [{"role": "system", "content": system_prompt}] + messages
        
        # Max steps to prevent loops
        max_steps = 3
        
        # Token tracking
        total_prompt_tokens = 0
        total_completion_tokens = 0
        
        # Initialize loop variables
        cart_updates = []
        current_general_note = None
        order_confirmed_status = False
        
        for step in range(max_steps):
            response = self.client.chat.completions.create(
                model=self.model,
                messages=current_messages,
                # stop=["Observation:"] # DISABLE STOP FOR DEBUGGING
            )
            
            # Extract token usage
            if hasattr(response, 'usage') and response.usage:
                prompt_tokens = response.usage.prompt_tokens or 0
                completion_tokens = response.usage.completion_tokens or 0
                total_prompt_tokens += prompt_tokens
                total_completion_tokens += completion_tokens
                logger.debug(f"TOKEN USAGE Step {step+1}: Prompt={prompt_tokens}, Completion={completion_tokens}")
            
            logger.debug(f"Messages sent: {json.dumps(current_messages[-1])}")
            
            try:
                content = response.choices[0].message.content
                if content is None: content = ""
                content = content.strip()
                
                # Clean up <think> tags from LLM response
                content = clean_llm_response(content)
                
                logger.debug(f"Cleaned Content: '{content[:200]}...'")
            except Exception as e:
                logger.debug(f"Error extracting content: {e}")
                content = ""
                
            logger.info(f"Agent Step {step+1}: {content[:200]}...")
            
            # Check for Action
            if "Action:" in content and "Action Input:" in content:
                # Parse action
                try:
                    action_line = [l for l in content.split('\n') if "Action:" in l][0]
                    input_line = [l for l in content.split('\n') if "Action Input:" in l][0]
                    
                    tool = action_line.split("Action:")[1].strip()
                    query = input_line.split("Action Input:")[1].strip()
                    
                    logger.info(f"TOOL CALL: {tool} with input: {query[:50]}...")
                    
                    # Execute
                    observation = ""
                    if tool == "lookup_menu":
                        observation = self.lookup_menu(query, detected_language)
                    elif tool == "lookup_info":
                        observation = self.lookup_info(query)
                        # AUTO-DISCOVERY: Check if the info text mentions any actual menu items
                        # This covers cases where the agent finds "Specials" in text but forgets to call lookup_menu
                        found_in_info = self.menu_manager.find_items_in_text(observation)
                        if found_in_info:
                            logger.info(f"Auto-discovered {len(found_in_info)} items in lookup_info result")
                            self.last_mentioned_items.extend(found_in_info)
                    elif tool == "set_language":
                        detected_language = query
                        observation = f"Language set to {detected_language}. Please respond in {detected_language} from now on."
                    elif tool == "add_to_cart":
                        try:
                            # Parse "Name, Qty, Notes"
                            parts = [x.strip() for x in query.split(',')]
                            item_name = parts[0]
                            qty = 1
                            notes = ""
                            if len(parts) > 1 and parts[1].replace('.','',1).isdigit():
                                qty = int(float(parts[1]))
                            if len(parts) > 2:
                                notes = ", ".join(parts[2:])
                            
                            # VALIDATION: Check if item exists in menu using fuzzy matching
                            import unicodedata
                            import re
                            
                            # Normalize search term: lowercase, remove hyphens, normalize spaces
                            search_name = item_name.lower().strip()
                            search_name = re.sub(r'[-_]', ' ', search_name)  # Replace hyphens/underscores with space
                            search_name = re.sub(r'\s+', ' ', search_name)   # Normalize multiple spaces
                            search_norm = unicodedata.normalize('NFD', search_name)
                            search_norm = ''.join(c for c in search_norm if unicodedata.category(c) != 'Mn')
                            
                            matched_item = None
                            for menu_item in self.retriever.menu_items:
                                if menu_item.get('type') == 'general_info':
                                    continue
                                    
                                # Normalize menu item name the same way
                                name = menu_item.get('item_name', '').lower()
                                name = re.sub(r'[-_]', ' ', name)
                                name = re.sub(r'\s+', ' ', name)
                                
                                viet = menu_item.get('item_viet', '').lower()
                                viet_norm = unicodedata.normalize('NFD', viet)
                                viet_norm = ''.join(c for c in viet_norm if unicodedata.category(c) != 'Mn')
                                
                                # Check exact match or partial match
                                if (name == search_name or 
                                    viet == search_name or 
                                    viet_norm == search_norm or
                                    search_name in name or 
                                    name in search_name or
                                    search_norm in viet_norm):
                                    matched_item = menu_item
                                    break
                            
                            if matched_item:
                                # Use the exact menu item name
                                exact_name = matched_item.get('item_name')
                                price = matched_item.get('price', 0)
                                cart_updates.append({"name": exact_name, "qty": qty, "notes": notes})
                                self.last_mentioned_items.append(matched_item)
                                observation = f"Successfully added {qty}x {exact_name} (${price:.2f}) to cart. {f'Notes: {notes}' if notes else ''}"
                            else:
                                # Item not found - suggest alternatives
                                similar = self.retriever.retrieve_items(item_name, top_k=3)
                                suggestions = [i.get('item_name') for i in similar if i.get('type') != 'general_info'][:3]
                                if suggestions:
                                    observation = f"Item '{item_name}' not found on our menu. Did you mean: {', '.join(suggestions)}? Please specify the exact item name."
                                else:
                                    observation = f"Item '{item_name}' not found on our menu. Please use lookup_menu to find available items."
                        except Exception as e:
                            observation = f"Error adding to cart: {e}"
                    elif tool == "set_general_note":
                        current_general_note = query
                        observation = f"General note set: {query}"
                    elif tool == "confirm_order":
                        order_confirmed_status = True
                        observation = "Order confirmed. Checkout button unlocked."
                    else:
                        observation = f"Error: Tool {tool} not found."
                        
                    logger.info(f"Tool Output: {observation[:200]}...")
                    
                    # Clean the assistant content: strip everything after Action Input line
                    # This removes fake observations the LLM might generate
                    clean_content = content
                    lines = content.split('\n')
                    for i, line in enumerate(lines):
                        if "Action Input:" in line:
                            clean_content = '\n'.join(lines[:i+1])
                            break
                    
                    # Append result to history
                    current_messages.append({"role": "assistant", "content": clean_content})
                    current_messages.append({"role": "user", "content": f"Observation: {observation}"})
                    
                except Exception as e:
                    logger.error(f"Parsing Error: {e}")
                    # If parsing fails, just return the content as is or try again?
                    # Usually better to break and ask user
                    return {
                        "text": content, 
                        "language": detected_language,
                        "mentioned_items": self.last_mentioned_items,
                        "cart_updates": current_cart_updates,
                        "general_note": current_general_note,
                        "order_confirmed": order_confirmed_status,
                        "token_usage": {
                            "prompt_tokens": total_prompt_tokens,
                            "completion_tokens": total_completion_tokens,
                            "total_tokens": total_prompt_tokens + total_completion_tokens
                        }
                    }
            else:
                # Filter mentioned_items: Only show items that are actually discussed in the final answer
                final_mentioned_items = self._filter_mentioned_items(content, self.last_mentioned_items)

                return {
                    "text": content, 
                    "language": detected_language,
                    "mentioned_items": final_mentioned_items,
                    "cart_updates": cart_updates,
                    "general_note": current_general_note,
                    "order_confirmed": order_confirmed_status,
                    "token_usage": {
                        "prompt_tokens": total_prompt_tokens,
                        "completion_tokens": total_completion_tokens,
                        "total_tokens": total_prompt_tokens + total_completion_tokens
                    }
                }

        # Fallback return if max_steps is exhausted without a final answer
        return {
            "text": "I apologize, I need a moment to process that differently. Could you ask that again or rephrase it?", 
            "language": detected_language,
            "mentioned_items": [],
            "cart_updates": [],
            "token_usage": {
                "prompt_tokens": total_prompt_tokens,
                "completion_tokens": total_completion_tokens,
                "total_tokens": total_prompt_tokens + total_completion_tokens
            }
        }

    def _normalize_for_match(self, text: str) -> str:
        """
        Normalize text for fuzzy matching.
        - Lowercase
        - Expand common abbreviations (w. -> with, & -> and)
        - Remove punctuation
        - Collapse spaces
        """
        text = text.lower()
        # Common abbreviations common in menu items
        text = text.replace(" w. ", " with ")
        text = text.replace(" & ", " and ")
        
        # Remove punctuation (keep spaces)
        import re
        text = re.sub(r'[^\w\s]', '', text)
        
        # Collapse spaces
        return re.sub(r'\s+', ' ', text).strip()

    def _filter_mentioned_items(self, content: str, candidate_items: list) -> list:
        """
        Filter items that are explicitly mentioned in the content.
        Uses normalized matching for robustness against abbreviations and formatting.
        """
        final_items = []
        # Normalize the content once
        content_norm = self._normalize_for_match(content)
        
        logger.debug(f"Normalized Content for matching: '{content_norm[:100]}...'")
        
        for item in candidate_items:
            # 1. Exact Name Match (Normalized)
            name = item.get('item_name', '')
            name_norm = self._normalize_for_match(name)
            
            if name_norm and name_norm in content_norm:
                final_items.append(item)
                continue
                
            # 2. Vietnamese Match (Flexible)
            viet = item.get('item_viet', '')
            if viet:
                viet_norm = self._normalize_for_match(viet)
                
                # Direct substring match
                if viet_norm and viet_norm in content_norm:
                    final_items.append(item)
                    continue
                
                # Partial match for long names
                viet_words = viet_norm.split()
                if len(viet_words) >= 4:
                    # Match first 4 words
                    core_name = " ".join(viet_words[:4])
                    if core_name in content_norm:
                        final_items.append(item)
                        continue

        return final_items
