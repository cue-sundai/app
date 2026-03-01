"""Speech-to-text service.

TODO: Replace mock with ElevenLabs STT integration.
"""

import itertools

# Simulated networking conversation for UI testing
_MOCK_LINES = itertools.cycle([
    "Hey, nice to meet you! I'm Sarah from the product team at Stripe.",
    "Great to meet you too! I'm Alex, I work on developer tools at Vercel.",
    "Oh cool, what kind of tools are you building?",
    "Mostly around deployment pipelines and edge functions. What about you?",
    "I'm leading our new API design initiative. We're rethinking how we do versioning.",
    "That's really interesting. We ran into versioning headaches last quarter.",
    "Yeah it's a common pain point. We should compare notes sometime.",
    "Definitely. Are you going to the AI infrastructure panel later today?",
    "Yes! I heard the speaker from Anthropic is talking about tool use patterns.",
    "I'll send you my notes from their last talk. Can I get your email?",
    "Sure, it's alex@vercel.com. I'll follow up with the deployment docs too.",
    "Perfect. Let's also schedule a call next week to dig into the versioning stuff.",
    "Sounds great. Maybe Wednesday or Thursday afternoon?",
    "Thursday works. I'll send a calendar invite.",
    "Awesome. Really glad we connected!",
])


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
    return next(_MOCK_LINES)
