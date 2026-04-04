import os
import subprocess
import struct
import hashlib
import re
import logging
import config

# Configure logging
logger = logging.getLogger("gac_waiter.tts")

class TTSClient:
    def __init__(self):
        self.piper_binary = config.PIPER_BINARY
        self.piper_models = config.PIPER_MODELS  # Dictionary of language models
        self.cache_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "cache", "tts")
        
        # Ensure cache directory exists
        os.makedirs(self.cache_dir, exist_ok=True)
        
        # Verify all models exist
        for lang, model_path in self.piper_models.items():
            if not os.path.exists(model_path):
                logger.warning(f"Piper model for '{lang}' not found at {model_path}")
        
        if not os.path.exists(self.piper_binary):
            logger.error(f"Piper binary not found at {self.piper_binary}")

    def _get_cache_key(self, text):
        """Generate cache key from text."""
        normalized = text.strip().lower()
        return hashlib.md5(normalized.encode('utf-8')).hexdigest()

    def _get_cache_path(self, cache_key):
        """Get full path to cached audio file."""
        return os.path.join(self.cache_dir, f"{cache_key}.wav")

    def _strip_markdown(self, text):
        """Remove markdown formatting from text for cleaner TTS output."""
        # Remove code blocks (```...```)
        text = re.sub(r'```[\s\S]*?```', '', text)
        
        # Remove inline code (`...`)
        text = re.sub(r'`([^`]+)`', r'\1', text)
        
        # Remove bold/italic (**text**, __text__, *text*, _text_)
        text = re.sub(r'\*\*\*(.+?)\*\*\*', r'\1', text)  # bold+italic
        text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)      # bold
        text = re.sub(r'__(.+?)__', r'\1', text)          # bold
        text = re.sub(r'\*(.+?)\*', r'\1', text)          # italic
        text = re.sub(r'_(.+?)_', r'\1', text)            # italic
        
        # Remove links [text](url) -> text
        text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
        
        # Remove headers (# ## ###)
        text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
        
        # Remove horizontal rules (---, ***)
        text = re.sub(r'^[\*\-]{3,}$', '', text, flags=re.MULTILINE)
        
        # Remove blockquotes (>)
        text = re.sub(r'^>\s+', '', text, flags=re.MULTILINE)
        
        # Remove list markers (-, *, +, 1.)
        text = re.sub(r'^[\*\-\+]\s+', '', text, flags=re.MULTILINE)
        text = re.sub(r'^\d+\.\s+', '', text, flags=re.MULTILINE)
        
        # Remove emojis (Range: U+1F600-U+1F64F, U+1F300-U+1F5FF, U+1F680-U+1F6FF, U+1F1E0-U+1F1FF, etc.)
        # Using a broad unicode range for common symbols and pictographs
        text = re.sub(r'[\U00010000-\U0010ffff]', '', text)
        
        # Replace multiple newlines with single space (for continuous speech)
        text = re.sub(r'\n\s*\n', ' ', text)
        
        # Replace single newlines with space (prevents TTS from stopping)
        text = re.sub(r'\n', ' ', text)
        
        # Clean up multiple spaces
        text = re.sub(r'\s+', ' ', text)
        text = text.strip()
        
        return text

    def _detect_language(self, text):
        """Detect the language of the text and return appropriate model."""
        try:
            from langdetect import detect
            lang_code = detect(text)
            
            # Map detected language to available models
            if lang_code == 'vi':
                return 'vi'
            elif lang_code in ['zh-cn', 'zh-tw', 'zh']:  # Chinese
                return 'zh'
            elif lang_code in ['es', 'ca', 'gl']:  # Spanish and related
                return 'es'
            else:
                return 'en'  # Default to English
        except Exception as e:
            logger.warning(f"Language detection error: {e}, defaulting to English")
            return 'en'

    def generate_audio(self, text):
        """
        Generates audio for the given text using Piper binary.
        Detects language automatically and selects appropriate voice.
        Checks cache first, generates if not found.
        Yields chunks of audio bytes (WAV formatted).
        """
        if not text:
            return

        # Strip markdown formatting for cleaner TTS
        clean_text = self._strip_markdown(text)
        if not clean_text:
            return

        # Detect language and select appropriate model
        detected_lang = self._detect_language(clean_text)
        selected_model = self.piper_models.get(detected_lang, self.piper_models['en'])
        
        logger.debug(f"Detected language: {detected_lang}, using model: {os.path.basename(selected_model)}")

        # Check cache (use original text + language for cache key)
        cache_key = self._get_cache_key(f"{detected_lang}:{text}")
        cache_path = self._get_cache_path(cache_key)
        
        if os.path.exists(cache_path):
            logger.debug(f"Using cached audio for: '{text[:50]}...'")
            with open(cache_path, 'rb') as f:
                yield f.read()
            return

        logger.debug(f"Generating audio for: '{clean_text[:50]}...'")
        
        cmd = [
            self.piper_binary,
            "--model", selected_model,
            "--output_file", "-"
        ]
        
        try:
            # Use Popen to stream stdout with timeout
            with subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE) as proc:
                # Send cleaned text (without markdown) with 30s timeout
                try:
                    stdout_data, stderr_data = proc.communicate(
                        input=clean_text.encode('utf-8'),
                        timeout=30  # 30 second timeout
                    )
                except subprocess.TimeoutExpired:
                    proc.kill()
                    logger.error("TTS generation timed out after 30 seconds")
                    return
                
                if proc.returncode != 0:
                    logger.error(f"Piper Error: {stderr_data.decode('utf-8')}")
                    return
                    
                # Patch WAV Header (Crucial for Browser Playback of Pipe Output)
                if len(stdout_data) > 44 and stdout_data.startswith(b'RIFF'):
                     # Calculate correct size
                     correct_size = len(stdout_data) - 8
                     # Pack into 4 bytes little-endian
                     size_bytes = struct.pack('<I', correct_size)
                     # Replace bytes 4-8
                     stdout_data = stdout_data[:4] + size_bytes + stdout_data[8:]
                     logger.debug(f"Patched WAV header size to {correct_size}")

                if len(stdout_data) > 0:
                    # Save to cache
                    try:
                        with open(cache_path, 'wb') as f:
                            f.write(stdout_data)
                        logger.debug(f"Cached audio at {cache_path}")
                    except Exception as e:
                        logger.warning(f"Cache write error: {e}")
                    
                    yield stdout_data
        except Exception as e:
            logger.error(f"Piper Execution Error: {e}")

