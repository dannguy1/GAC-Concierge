import sys
import os
import re
import time
import json
import hmac
import asyncio
import logging
import threading
from contextlib import asynccontextmanager
from collections import defaultdict
from functools import wraps

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("gac_waiter.api")

logger.info(f"API STARTING - VERSION ID: {time.time()}")

# Add project root to path to allow importing config
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# CRITICAL: Load .env file explicitly
from dotenv import load_dotenv
load_dotenv(override=True)

from fastapi import FastAPI, HTTPException, Body, Request, Header, Depends
from fastapi.responses import JSONResponse, Response, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import List, Optional, Dict, Any
import base64
import config

# Print config on startup for debugging
logger.info("=" * 60)
logger.info("Backend API Starting - Configuration:")
logger.info(f"LLM_BASE_URL: {config.LLM_BASE_URL}")
logger.info(f"LLM_MODEL: {config.LLM_MODEL}")
logger.info(f"API_PORT: {config.API_PORT}")
logger.info("=" * 60)

# Import logic classes
from backend.menu_manager import MenuManager
from backend.tts_client import TTSClient
from backend.agent import WaitstaffAgent
from backend.rag_retriever import get_retriever
from backend.display_agent import get_display_agent

# Initialize singletons
menu_manager = MenuManager()
tts_client = TTSClient()
get_retriever()  # Eagerly initialize RAG at startup to avoid first-request delay
agent = WaitstaffAgent()
display_agent = get_display_agent()
display_agent.load_menu(menu_manager.items)

# SSE subscriber queues — one asyncio.Queue per connected display client
_sse_subscribers: list[asyncio.Queue] = []
_sse_lock = asyncio.Lock()


async def _fanout_loop():
    """Single background task: fans out display_agent events to all SSE subscribers."""
    while True:
        event = await display_agent.queue.get()
        async with _sse_lock:
            for q in list(_sse_subscribers):
                await q.put(event)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start background tasks on startup, clean up on shutdown."""
    display_task = asyncio.create_task(display_agent.run())
    fanout_task = asyncio.create_task(_fanout_loop())
    logger.info("DisplayAgent background task started")
    yield
    display_task.cancel()
    fanout_task.cancel()
    for task in (display_task, fanout_task):
        try:
            await task
        except asyncio.CancelledError:
            pass
    logger.info("DisplayAgent background task stopped")


# Create FastAPI app
app = FastAPI(title="GAC Waiter Backend", lifespan=lifespan)

# Add CORS Middleware (Required for React Frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:8501",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8501",
        "http://127.0.0.1:5173",
        "http://192.168.10.3:8501",
        "http://192.168.10.3:5173",
        "http://gacaiserver:8501",
        "http://gacaiserver:5173",
        "http://gacaiserver:8503",
        "http://localhost:8503",
        "http://127.0.0.1:8503",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Static Files for Images (Accessible at /images/...)
# Ensure data/images exists
if not os.path.exists("data/images"):
    os.makedirs("data/images", exist_ok=True)
if not os.path.exists("data/downloaded_images"):
    os.makedirs("data/downloaded_images", exist_ok=True)

# Mount both image directories if needed, or normalize to one.
# App uses 'data/images', 'data/downloaded_images'.
# We can mount generic 'data' or specific.
# Let's mount /images to data/images
app.mount("/images", StaticFiles(directory="data/images"), name="images")
# And /downloaded_images
app.mount("/downloaded_images", StaticFiles(directory="data/downloaded_images"), name="downloaded_images")

# ============== RATE LIMITING ==============
rate_limit_store = defaultdict(list)
rate_limit_lock = threading.Lock()
RATE_LIMIT_REQUESTS = 30  # requests per window
RATE_LIMIT_WINDOW = 60    # seconds

def rate_limiter(func):
    """Simple rate limiter decorator."""
    @wraps(func)
    async def wrapper(request: Request, *args, **kwargs):
        client_ip = request.client.host if request.client else "unknown"
        current_time = time.time()

        with rate_limit_lock:
            rate_limit_store[client_ip] = [
                t for t in rate_limit_store[client_ip]
                if current_time - t < RATE_LIMIT_WINDOW
            ]
            if len(rate_limit_store[client_ip]) >= RATE_LIMIT_REQUESTS:
                logger.warning(f"Rate limit exceeded for {client_ip}")
                raise HTTPException(status_code=429, detail="Rate limit exceeded. Please slow down.")
            rate_limit_store[client_ip].append(current_time)

        return await func(request, *args, **kwargs)
    return wrapper

# ============== REQUEST MODELS WITH VALIDATION ==============
class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    messages: List[Dict[str, Any]] = Field(..., max_length=100, description="Conversation history")
    language: Optional[str] = Field(default="English", max_length=20)
    
    @field_validator('messages')
    @classmethod
    def validate_messages(cls, v):
        if not v:
            raise ValueError('Messages cannot be empty')
        for msg in v:
            content = str(msg.get('content', ''))
            if len(content) > 10000:
                raise ValueError('Message content too long (max 10000 chars)')
        return v

class CartItemRequest(BaseModel):
    item_name: str
    quantity: int
    notes: Optional[str] = ""
    price: float

class CheckOutRequest(BaseModel):
    model_config = ConfigDict(extra="allow")

    cart: List[CartItemRequest]
    general_notes: Optional[str] = ""

def verify_api_key(x_api_key: str = Header(None)):
    if not config.ADMIN_API_KEY or not hmac.compare_digest(x_api_key or "", config.ADMIN_API_KEY):
        raise HTTPException(status_code=401, detail="Invalid API Key")

@app.get("/v1/health")
def health_endpoint():
    return {
        "status": "healthy",
        "menu_items_loaded": len(menu_manager.items),
        "version": "1.0-Concierge"
    }

@app.get("/v1/menu")
def get_menu():
    """Returns the full menu as JSON."""
    return menu_manager.items


@app.get("/v1/display/stream")
async def display_stream():
    """
    SSE endpoint for menu-display clients.
    Each connected client gets its own queue; the display_agent broadcast loop
    fans out events by draining the shared display_agent.queue into all subscriber queues.
    """
    client_queue: asyncio.Queue = asyncio.Queue()

    async with _sse_lock:
        _sse_subscribers.append(client_queue)
    logger.info(f"Display SSE client connected — {len(_sse_subscribers)} active")

    async def event_generator():
        # Send an initial ping so the browser knows the connection is live
        yield "event: ping\ndata: {}\n\n"
        try:
            while True:
                try:
                    event_data = await asyncio.wait_for(client_queue.get(), timeout=25)
                    payload = json.dumps(event_data, default=str)
                    yield f"data: {payload}\n\n"
                except asyncio.TimeoutError:
                    # Send keepalive comment so proxies don't close the connection
                    yield ": keepalive\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            async with _sse_lock:
                try:
                    _sse_subscribers.remove(client_queue)
                except ValueError:
                    pass
            logger.info(f"Display SSE client disconnected — {len(_sse_subscribers)} active")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable nginx buffering
        },
    )

@app.post("/v1/chat")
def chat_endpoint(request: ChatRequest):
    try:
        # Get user's latest message for retrieval
        user_message = ""
        if request.messages:
            user_message = request.messages[-1].get('content', '')
        
        # Prepare messages
        clean_messages = []
        for msg in request.messages:
            clean_msg = {"role": msg.get("role"), "content": msg.get("content")}
            clean_messages.append(clean_msg)
        
        # AGENT RUN
        # The agent handles tool-use, retrieval, and prompts internally
        # response_text is now a DICT: {"text": str, "language": str}
        agent_result = agent.run(clean_messages, current_language=request.language)
        
        if isinstance(agent_result, dict):
            response_text = agent_result.get("text", "")
            detected_lang = agent_result.get("language", request.language)
        else:
            # Fallback if agent returns string (should not happen with new code)
            response_text = str(agent_result)
            detected_lang = request.language
        
        # FINAL CLEANUP: Strip <think> tags from response before sending to frontend
        if response_text:
            response_text = re.sub(r'<think>.*?</think>|</?think>', '', response_text, flags=re.DOTALL)
            response_text = response_text.strip()
        
        # Find mentioned items (for UI to display images)
        # We rely SOLELY on the agent's explicit Mentioned Items to prevent hallucinations
        # or accidental matching of common words (like "Chicken") to menu items.
        mentioned = agent_result.get("mentioned_items", [])
        
        cart_updates = []
        if isinstance(agent_result, dict):
            cart_updates = agent_result.get("cart_updates", [])
            
        return {
            "text": response_text,
            "language": detected_lang,
            "mentioned_items": mentioned,
            "cart_updates": cart_updates,
            "general_note": agent_result.get("general_note"),
            "order_confirmed": agent_result.get("order_confirmed", False)
        }
    except Exception as e:
        import traceback
        logger.error(f"API Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/v1/tts")
def tts_endpoint(request: dict = Body(...)):
    """Generate TTS audio on-demand for given text."""
    try:
        text = request.get("text", "")
        language = request.get("language", "")
        if not text:
            raise HTTPException(status_code=400, detail="No text provided")
        
        if not config.ENABLE_SERVER_AUDIO:
            return {"audio_base64": None}
        
        # Generate audio using TTS client
        audio_bytes = b"".join(list(tts_client.generate_audio(text, language=language)))
        audio_b64 = base64.b64encode(audio_bytes).decode('utf-8') if audio_bytes else None
        
        return {
            "audio_base64": audio_b64
        }
    except Exception as e:
        import traceback
        logger.error(f"TTS Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/v1/checkout")
def checkout_endpoint(request: CheckOutRequest):
    """
    Process a structured checkout request (Cart -> Order).
    Validates items against the menu and calculates final total.
    """
    try:
        validated_order = []
        total_price = 0.0
        
        # simple validation against loaded menu
        # Create a lookup map for faster validation
        menu_map = {item['item_name'].lower(): item for item in menu_manager.items}
        
        for cart_item in request.cart:
            # 1. Validate existence
            clean_name = cart_item.item_name.strip()
            lookup_name = clean_name.lower()
            
            if lookup_name not in menu_map:
                logger.warning(f"Checkout: Item not found in menu: {clean_name}")
                # We could reject, or skip. For now, let's skip invalid items purely for safety
                continue
                
            real_item = menu_map[lookup_name]
            
            # 2. Validate Price (Server-side authority)
            # Use price from DB, not client, to prevent tampering
            real_price = real_item.get('price', 0)
            
            line_total = real_price * cart_item.quantity
            total_price += line_total
            
            validated_order.append({
                "name": real_item['item_name'], # Use canonical name
                "qty": cart_item.quantity,
                "price": real_price,
                "notes": cart_item.notes,
                "line_total": line_total
            })
            
        return {
            "order": validated_order,
            "general_notes": request.general_notes,
            "total": total_price,
            "message": "Order validated and received."
        }
            
    except Exception as e:
        import traceback
        logger.error(f"Checkout Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/v1/reload", dependencies=[Depends(verify_api_key)])
def reload_endpoint():
    """Reloads all data (Menu and RAG) from disk."""
    try:
        menu_manager.reload()

        from backend.rag_retriever import get_retriever
        retriever = get_retriever()
        retriever.reload()

        display_agent.load_menu(menu_manager.items)

        return {"status": "success", "message": "Data reloaded successfully"}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=config.API_PORT)
