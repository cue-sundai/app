"""Speech-to-text service.

TODO: Replace mock with ElevenLabs STT integration.
"""


async def transcribe(audio_bytes: bytes) -> str:
    """Transcribe an audio chunk to text.

    Args:
        audio_bytes: Raw audio data from the client (WebM/opus from MediaRecorder).

    Returns:
        Transcribed text string.
    """
    # --- PLACEHOLDER ---
    # Replace this with ElevenLabs API call:
    #   from elevenlabs import ElevenLabs
    #   client = ElevenLabs(api_key=os.environ["ELEVENLABS_API_KEY"])
    #   result = client.speech_to_text.convert(audio=audio_bytes, ...)
    #   return result.text
    return "[mock transcription] Hello, nice to meet you!"
