import asyncio
import json

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from models import SummarizeRequest, SummarizeResponse
from services.realtime_stt import run_realtime_session
from services.summarizer import summarize

load_dotenv()

app = FastAPI(title="Side-Quest API")

app.add_middleware(
    CORSMiddleware,  # ty: ignore[invalid-argument-type]
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.websocket("/ws/transcribe")
async def websocket_transcribe(ws: WebSocket):
    """Proxy client audio to ElevenLabs realtime STT; stream segments back. All in-memory."""
    await ws.accept()
    mime_type: str = "audio/webm"
    first = await ws.receive()
    if "text" in first:
        try:
            data = json.loads(first["text"])
            mime_type = data.get("mimeType", mime_type)
        except Exception:
            pass

    audio_queue: asyncio.Queue[bytes | None] = asyncio.Queue()
    out_queue: asyncio.Queue[tuple[str, object]] = asyncio.Queue()

    async def receive_loop():
        if "bytes" in first and first["bytes"] and len(first["bytes"]) >= 200:
            await audio_queue.put(first["bytes"])
        while True:
            message = await ws.receive()
            if "text" in message:
                try:
                    data = json.loads(message["text"])
                    if data.get("newSession"):
                        await audio_queue.put(None)
                except Exception:
                    pass
                continue
            if "bytes" in message:
                chunk = message["bytes"]
                if chunk and len(chunk) >= 200:
                    await audio_queue.put(chunk)

    realtime_task: asyncio.Task | None = None
    recv_task: asyncio.Task | None = None

    try:
        recv_task = asyncio.create_task(receive_loop())
        realtime_task = asyncio.create_task(
            run_realtime_session(
                mime_type=mime_type,
                audio_chunk_queue=audio_queue,
                out_queue=out_queue,
            )
        )

        while True:
            try:
                kind, payload = await asyncio.wait_for(out_queue.get(), timeout=0.25)
            except asyncio.TimeoutError:
                continue
            if kind == "segments":
                await ws.send_json(
                    {"segments": payload, "is_final": False, "replace": False, "is_partial": False}
                )
            elif kind == "partial":
                await ws.send_json(
                    {"segments": payload, "is_final": False, "replace": False, "is_partial": True}
                )
            elif kind == "error":
                await ws.send_json(
                    {
                        "segments": [
                            {"speaker": 0, "text": f"[Transcription error: {payload}]"}
                        ],
                        "is_final": False,
                        "replace": False,
                    }
                )
    except WebSocketDisconnect:
        pass
    finally:
        if recv_task and not recv_task.done():
            recv_task.cancel()
            try:
                await recv_task
            except asyncio.CancelledError:
                pass
        if realtime_task and not realtime_task.done():
            realtime_task.cancel()
            try:
                await realtime_task
            except asyncio.CancelledError:
                pass


@app.post("/api/summarize", response_model=SummarizeResponse)
async def summarize_conversation(req: SummarizeRequest):
    """Summarize the full conversation transcript."""
    result = await summarize(req.transcript)
    return SummarizeResponse(**result)
