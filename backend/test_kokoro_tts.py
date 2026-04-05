import sys
import os
import argparse

# Add the project root to path so we can import config & backend modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.tts_client import TTSClient

def test_tts(text="Hello, welcome to GAC Concierge. How can I help you today?"):
    print("Initializing TTS Client...")
    tts = TTSClient()
    
    print(f"Generating audio for text: '{text}'")
    # generate_audio returns a generator emitting bytes
    generator = tts.generate_audio(text)
    
    if not generator:
        print("Error: generate_audio returned None")
        return
        
    try:
        audio_bytes = next(generator)
        print(f"Success! Generated {len(audio_bytes)} bytes of WAV audio data.")
        
        # Optionally write to file
        with open("test_output.wav", "wb") as f:
            f.write(audio_bytes)
        print("Saved to test_output.wav")
    except StopIteration:
        print("Error: TTS generator yielded no data.")
    except Exception as e:
        print(f"Error during audio generation: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--text", type=str, help="Text to convert to speech", default="Hello, welcome to the Concierge. Please wait while I pull up the menu.")
    args = parser.parse_args()
    test_tts(args.text)
