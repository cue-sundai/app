"""Speech-to-text with speaker diarization.

All processing is in-memory (no temp files). Uses ElevenLabs STT with diarize=True.
Converts browser audio to WAV in memory so ElevenLabs always gets a valid file.
"""

import asyncio
import io
import os
from typing import Any


def _get_elevenlabs_key() -> str:
    raw = os.environ.get("ELEVEN_LABS_API_KEY") or os.environ.get("ELEVENLABS_API_KEY")
    return (raw or "").strip()


def _mime_to_pydub_format(mime_type: str) -> str:
    m = (mime_type or "").strip().lower()
    if "webm" in m:
        return "webm"
    if "mp4" in m or "m4a" in m:
        return "mp4"
    if "ogg" in m:
        return "ogg"
    return "webm"


def _to_wav_in_memory(audio_bytes: bytes, mime_type: str) -> bytes | None:
    """Convert browser audio bytes to WAV in memory. Returns None on failure."""
    try:
        from pydub import AudioSegment

        fmt = _mime_to_pydub_format(mime_type)
        seg = AudioSegment.from_file(io.BytesIO(audio_bytes), format=fmt)
        out = io.BytesIO()
        seg.export(out, format="wav")
        return out.getvalue()
    except Exception:
        return None


def _transcribe_elevenlabs(
    audio_bytes: bytes, api_key: str, filename: str = "audio.wav"
) -> list[dict[str, Any]]:
    """Transcribe with ElevenLabs; return list of {speaker: int, text: str}."""
    from elevenlabs import ElevenLabs

    client = ElevenLabs(api_key=api_key)
    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = filename

    result = client.speech_to_text.convert(
        file=audio_file,
        model_id="scribe_v1",
        diarize=True,
    )

    segments: list[dict[str, Any]] = []
    words_raw = getattr(result, "words", None) or getattr(result, "chunks", None)
    words: list[Any] = list(words_raw) if words_raw is not None else []
    if not words and hasattr(result, "text"):
        text = (getattr(result, "text", None) or "").strip()
        if text:
            segments.append({"speaker": 0, "text": text})
        return segments

    current_speaker: int | None = None
    current_words: list[str] = []

    for w in words:
        word_str = getattr(w, "word", None) or getattr(w, "text", None)
        if word_str is None and hasattr(w, "punctuated_word"):
            word_str = getattr(w, "punctuated_word", None)
        if not isinstance(word_str, str):
            continue
        speaker = getattr(w, "speaker_id", None) or getattr(w, "speaker", 0)
        if speaker is None:
            speaker = 0
        if isinstance(speaker, (int, float)):
            speaker = int(speaker)

        if current_speaker is not None and speaker != current_speaker:
            if current_words:
                segments.append(
                    {"speaker": current_speaker, "text": " ".join(current_words)}
                )
            current_words = []
        current_speaker = speaker
        current_words.append(word_str)

    if current_words and current_speaker is not None:
        segments.append({"speaker": current_speaker, "text": " ".join(current_words)})

    if not segments and getattr(result, "text", None):
        segments.append({"speaker": 0, "text": (result.text or "").strip()})

    return segments


async def transcribe(
    audio_bytes: bytes, mime_type: str = "audio/webm"
) -> list[dict[str, Any]]:
    """Transcribe an audio chunk with speaker diarization. All in-memory, no disk.

    Converts to WAV in memory so ElevenLabs receives a valid file; falls back to
    raw bytes if conversion fails.
    """
    if not audio_bytes or len(audio_bytes) < 500:
        return []

    api_key = _get_elevenlabs_key()
    if not api_key:
        return [{"speaker": 0, "text": "[Set ELEVEN_LABS_API_KEY for transcription]"}]

    wav_bytes = _to_wav_in_memory(audio_bytes, mime_type)
    if wav_bytes and len(wav_bytes) > 1000:
        to_send = wav_bytes
        filename = "audio.wav"
    else:
        to_send = audio_bytes
        ext = (
            "webm"
            if "webm" in (mime_type or "").lower()
            else "m4a"
            if "mp4" in (mime_type or "").lower()
            else "ogg"
        )
        filename = f"audio.{ext}"

    try:
        return await asyncio.to_thread(
            _transcribe_elevenlabs, to_send, api_key, filename
        )
    except Exception as e:
        return [{"speaker": 0, "text": f"[Transcription error: {e!s}]"}]
