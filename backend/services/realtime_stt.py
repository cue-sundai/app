"""ElevenLabs Speech-to-Text Realtime WebSocket. All in-memory, no files."""

import asyncio
import base64
import json
import os
import shutil
from typing import Any

REALTIME_URL = "wss://api.elevenlabs.io/v1/speech-to-text/realtime"
SAMPLE_RATE = 16000
MIN_CHUNKS_TO_CONVERT = 2


def _get_api_key() -> str:
    raw = os.environ.get("ELEVEN_LABS_API_KEY") or os.environ.get("ELEVENLABS_API_KEY")
    return (raw or "").strip()


async def _audio_to_pcm_16k(audio_bytes: bytes, mime_type: str) -> bytes:
    """Convert WebM/MP4/OGG to PCM 16kHz mono using PyAV. No system ffmpeg required."""
    def _convert():
        # Open the audio bytes as an in-memory file
        import av
        import io
        container = av.open(io.BytesIO(audio_bytes))
        
        # Set up a resampler to get 16kHz, mono, 16-bit PCM (s16le)
        resampler = av.AudioResampler(
            format='s16', 
            layout='mono', 
            rate=16000
        )
        
        pcm_data = bytearray()
        for frame in container.decode(audio=0):
            resampled_frames = resampler.resample(frame)
            for resampled_frame in resampled_frames:
                # Extract the raw PCM bytes
                pcm_data.extend(resampled_frame.to_ndarray().tobytes())
                
        return bytes(pcm_data)

    # Run the synchronous CPU-bound conversion in a threadpool so it doesn't block asyncio
    return await asyncio.to_thread(_convert)


async def run_realtime_session(
    *,
    mime_type: str,
    audio_chunk_queue: asyncio.Queue[bytes | None],
    out_queue: asyncio.Queue[tuple[str, Any]],
) -> None:
    """Connect to ElevenLabs realtime STT; consume from audio_chunk_queue (bytes or None for newSession); put ("segments", list) or ("error", str) in out_queue."""
    api_key = _get_api_key()
    if not api_key:
        out_queue.put_nowait(("error", "[Set ELEVEN_LABS_API_KEY for transcription]"))
        return

    try:
        import websockets
    except ImportError:
        out_queue.put_nowait(("error", "Install websockets"))
        return

    url = (
        f"{REALTIME_URL}?model_id=scribe_v2_realtime"
        f"&audio_format=pcm_16000"
        f"&commit_strategy=vad"
        f"&include_timestamps=true"
    )
    headers = {"xi-api-key": api_key}

    header_chunk: bytes | None = None

    async def consume_queue(ws: Any) -> None:
        nonlocal header_chunk
        while True:
            chunk = await audio_chunk_queue.get()
            if chunk is None:
                header_chunk = None
                continue
            if len(chunk) < 200:
                continue
            if header_chunk is None:
                header_chunk = chunk
                continue
            merged = header_chunk + chunk
            try:
                pcm = await _audio_to_pcm_16k(merged, mime_type)
            except Exception as e:
                out_queue.put_nowait(("error", str(e)))
                continue
            if not pcm or len(pcm) < 100:
                continue
            b64 = base64.standard_b64encode(pcm).decode("ascii")
            await ws.send(
                json.dumps(
                    {
                        "message_type": "input_audio_chunk",
                        "audio_base_64": b64,
                        "sample_rate": SAMPLE_RATE,
                        "commit": False,
                    }
                )
            )

    try:
        async with websockets.connect(
            url,
            additional_headers=headers,
            close_timeout=2,
            open_timeout=10,
        ) as ws:
            out_queue.put_nowait(
                ("segments", [{"speaker": 0, "text": "[Live captions connected]"}])
            )
            consumer = asyncio.create_task(consume_queue(ws))
            try:
                async for raw in ws:
                    if isinstance(raw, bytes):
                        raw = raw.decode("utf-8", errors="replace")
                    try:
                        msg = json.loads(raw)
                    except Exception:
                        continue
                    mt = msg.get("message_type")
                    if mt == "partial_transcript":
                        text = (msg.get("text") or "").strip()
                        if text:
                            out_queue.put_nowait(
                                ("partial", [{"speaker": 0, "text": text}])
                            )
                        continue
                    if mt == "committed_transcript":
                        text = (msg.get("text") or "").strip()
                        if text:
                            out_queue.put_nowait(
                                ("segments", [{"speaker": 0, "text": text}])
                            )
                    elif mt == "committed_transcript_with_timestamps":
                        text = (msg.get("text") or "").strip()
                        if text:
                            words = msg.get("words") or []
                            segments = []
                            cur_speaker = 0
                            cur_words = []
                            for w in words:
                                sp = w.get("speaker_id") or 0
                                if isinstance(sp, str) and sp.isdigit():
                                    sp = int(sp)
                                elif not isinstance(sp, int):
                                    sp = 0
                                t = (w.get("text") or "").strip()
                                if not t:
                                    continue
                                if cur_words and sp != cur_speaker:
                                    segments.append(
                                        {
                                            "speaker": cur_speaker,
                                            "text": " ".join(cur_words),
                                        }
                                    )
                                    cur_words = []
                                cur_speaker = sp
                                cur_words.append(t)
                            if cur_words:
                                segments.append(
                                    {
                                        "speaker": cur_speaker,
                                        "text": " ".join(cur_words),
                                    }
                                )
                            if segments:
                                out_queue.put_nowait(("segments", segments))
                            else:
                                out_queue.put_nowait(
                                    ("segments", [{"speaker": 0, "text": text}])
                                )
                    elif mt in ("error", "auth_error", "transcriber_error"):
                        out_queue.put_nowait(
                            ("error", msg.get("error", "Unknown error"))
                        )
            finally:
                consumer.cancel()
                try:
                    await consumer
                except asyncio.CancelledError:
                    pass
    except Exception as e:
        out_queue.put_nowait(("error", f"Realtime STT connection failed: {e!s}"))
