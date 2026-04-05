import os
import hashlib
import re
import logging
import io
import config

# Configure logging
logger = logging.getLogger("gac_waiter.tts")

class TTSClient:
    def __init__(self):
        self.voices = config.KOKORO_VOICES
        self.cache_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "cache", "tts")
        
        # Ensure cache directory exists
        os.makedirs(self.cache_dir, exist_ok=True)
        
        # Kokoro pipelines per language code
        self.pipelines = {}

    def _map_lang_to_kokoro(self, lang_code):
        """Map standard language codes to Kokoro's internal codes."""
        mapping = {
            'en': 'a',
            'es': 'e',
            'fr': 'f',
            'hi': 'h',
            'it': 'i',
            'pt': 'p',
            'ja': 'j',
            'zh': 'z'
        }
        return mapping.get(lang_code, 'a')

    def _get_pipeline(self, k_lang):
        """Lazy load the Kokoro pipeline."""
        if k_lang not in self.pipelines:
            try:
                from kokoro import KPipeline
                import torch
                device = "cuda" if torch.cuda.is_available() else "cpu"
                logger.info(f"Initializing Kokoro KPipeline for lang_code='{k_lang}' on {device}")
                self.pipelines[k_lang] = KPipeline(lang_code=k_lang)
            except ImportError as e:
                logger.error(f"Failed to import Kokoro: {e}. Did you install it?")
                raise e
        return self.pipelines[k_lang]

    def _get_cache_key(self, text):
        """Generate cache key from text."""
        normalized = text.strip().lower()
        return hashlib.md5(normalized.encode('utf-8')).hexdigest()

    def _get_cache_path(self, cache_key):
        """Get full path to cached audio file."""
        return os.path.join(self.cache_dir, f"{cache_key}.wav")

    def _strip_markdown(self, text):
        """Remove markdown formatting from text for cleaner TTS output."""
        text = re.sub(r'```[\s\S]*?```', '', text)
        text = re.sub(r'`([^`]+)`', r'\1', text)
        text = re.sub(r'\*\*\*(.+?)\*\*\*', r'\1', text)
        text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
        text = re.sub(r'__(.+?)__', r'\1', text)
        text = re.sub(r'\*(.+?)\*', r'\1', text)
        text = re.sub(r'_(.+?)_', r'\1', text)
        text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
        text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
        text = re.sub(r'^[\*\-]{3,}$', '', text, flags=re.MULTILINE)
        text = re.sub(r'^>\s+', '', text, flags=re.MULTILINE)
        text = re.sub(r'^[\*\-\+]\s+', '', text, flags=re.MULTILINE)
        text = re.sub(r'^\d+\.\s+', '', text, flags=re.MULTILINE)
        text = re.sub(r'[\U00010000-\U0010ffff]', '', text)
        text = re.sub(r'\n\s*\n', ' ', text)
        text = re.sub(r'\n', ' ', text)
        text = re.sub(r'\s+', ' ', text)
        text = text.strip()
        return text

    def _detect_language(self, text):
        """Detect the language of the text. Defaults to English."""
        try:
            from langdetect import detect
            lang_code = detect(text)
            
            # Map exact language codes
            if lang_code in ['zh-cn', 'zh-tw', 'zh']: return 'zh'
            elif lang_code in ['es', 'ca', 'gl']: return 'es'
            elif lang_code == 'fr': return 'fr'
            elif lang_code == 'hi': return 'hi'
            elif lang_code == 'it': return 'it'
            elif lang_code == 'pt': return 'pt'
            elif lang_code == 'ja': return 'ja'
            elif lang_code == 'vi': return 'vi'
            else: return 'en'
        except Exception as e:
            logger.warning(f"Language detection error: {e}, defaulting to English")
            return 'en'

    def _normalize_lang_name(self, lang_name):
        """Convert a UI language string into standard ISO codes for mapping."""
        if not lang_name:
            return None
            
        nm = lang_name.lower()
        if "english" in nm: return "en"
        if "spanish" in nm: return "es"
        if "vietnamese" in nm: return "vi"
        if "chinese" in nm: return "zh"
        if "french" in nm: return "fr"
        if "italian" in nm: return "it"
        if "portuguese" in nm: return "pt"
        if "hindi" in nm: return "hi"
        if "japanese" in nm: return "ja"
        return None

    def generate_audio(self, text, language=None):
        """
        Generates audio using Kokoro TTS.
        """
        if not text:
            return

        clean_text = self._strip_markdown(text)
        if not clean_text:
            return

        # Use explicitly provided language if available, otherwise auto-detect
        explicit_lang = self._normalize_lang_name(language)
        detected_lang = explicit_lang if explicit_lang else self._detect_language(clean_text)

        k_lang = self._map_lang_to_kokoro(detected_lang)
        voice = self.voices.get(detected_lang, self.voices['en'])
        
        logger.debug(f"Generating audio. Language: {detected_lang}, Kokoro lang: {k_lang}, Voice: {voice}")

        cache_key = self._get_cache_key(f"{detected_lang}:{voice}:{text}")
        cache_path = self._get_cache_path(cache_key)
        
        if os.path.exists(cache_path):
            logger.debug(f"Using cached audio for: '{text[:50]}...'")
            with open(cache_path, 'rb') as f:
                yield f.read()
            return

        logger.debug(f"Running Kokoro TTS for: '{clean_text[:50]}...'")
        
        try:
            pipeline = self._get_pipeline(k_lang)
            import soundfile as sf
            import numpy as np
            # Use generation pipeline
            generator = pipeline(clean_text, voice=voice, speed=1, split_pattern=r'\n+')
            
            audio_chunks = []
            for gs, ps, audio in generator:
                if audio is not None:
                    audio_chunks.append(audio)
            
            if not audio_chunks:
                logger.error("No audio generated by Kokoro.")
                return
                
            full_audio = np.concatenate(audio_chunks)
            buffer = io.BytesIO()
            sf.write(buffer, full_audio, config.TTS_SAMPLE_RATE, format='WAV')
            buffer.seek(0)
            wav_data = buffer.read()
            
            # Save to cache
            try:
                with open(cache_path, 'wb') as f:
                    f.write(wav_data)
                logger.debug(f"Cached audio at {cache_path}")
            except Exception as e:
                logger.warning(f"Cache write error: {e}")
            
            yield wav_data
            
        except Exception as e:
            logger.error(f"Kokoro Execution Error: {e}")
