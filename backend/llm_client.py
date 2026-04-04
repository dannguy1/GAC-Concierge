from openai import OpenAI
import config

class LLMClient:
    def __init__(self):
        self.client = OpenAI(
            base_url=config.LLM_BASE_URL,
            api_key=config.LLM_API_KEY,
            timeout=60.0  # 60 second timeout
        )
        self.model = config.LLM_MODEL

    def get_waiter_response(self, messages, menu_context):
        """
        Generates a response from the waiter persona.
        
        messages: List of conversation history [{"role": "user", "content": ...}, ...]
        menu_context: Compact menu summary (categories only, not full menu)
        """
        
        system_prompt = f"""You are a polite, helpful, and knowledgeable restaurant waiter at 'Garlic & Chives'.

GREETING PROTOCOL (First Message Only):
- Introduce yourself warmly: "Good evening! Welcome to Garlic & Chives. My name is [choose a name], and I'll be taking care of you today."
- Ask if this is their first visit
- Mention you're happy to explain our menu

CRITICAL WORKFLOW:
1. EXPLORE: Help customers browse the menu. You have access to our menu categories below.
2. CHECK ALLERGIES: Before finalizing orders, ask about food allergies.
3. CONFIRM: Repeat the full order back with prices.
4. FINALIZE: Thank them warmly after confirmation.

CLOSING PROTOCOL:
- Thank them sincerely
- Express hope to see them again

{menu_context}

IMPORTANT: Keep responses concise (2-3 sentences). Be warm and professional."""

        # Prepend system message
        full_messages = [{"role": "system", "content": system_prompt}] + messages

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=full_messages
            )
            return response.choices[0].message.content
        except Exception as e:
            import traceback
            print(f"LLM Error: {e}")
            print(f"Full traceback:")
            traceback.print_exc()
            return "I apologize, but I'm having trouble thinking right now. Could you repeat that?"
