import asyncio
import json
import base64

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from models import (
    SummarizeRequest,
    SummarizeResponse,
    ChatRequest,
    ChatResponse,
    AgentInterjectRequest,
    AgentInterjectResponse,
)
from services.realtime_stt import run_realtime_session
from services.summarizer import summarize, chat_with_llm, agent_interject

load_dotenv()

app = FastAPI(title="Side-Quest API")

app.add_middleware(
    CORSMiddleware,  # type: ignore[invalid-argument-type]
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

    speaker_tasks: dict[int, asyncio.Task] = {}
    speaker_queues: dict[int, asyncio.Queue] = {}

    out_queue: asyncio.Queue[tuple[str, object, int]] = asyncio.Queue()

    async def receive_loop():
        try:
            while True:
                message = await ws.receive()
                if "text" in message:
                    try:
                        data = json.loads(message["text"])
                        if data.get("newSession"):
                            for q in speaker_queues.values():
                                await q.put(None)
                            continue

                        if "bytesb64" in data:
                            chunk = base64.b64decode(data["bytesb64"])
                            speakers = data.get("speakers", [0])
                            if not speakers:
                                speakers = [0]

                            for sp in speakers:
                                if sp not in speaker_queues:
                                    sq = asyncio.Queue()
                                    speaker_queues[sp] = sq
                                    speaker_tasks[sp] = asyncio.create_task(
                                        run_realtime_session(
                                            mime_type="audio/pcm",
                                            audio_chunk_queue=sq,
                                            out_queue=out_queue,
                                            speaker_id=sp,
                                        )
                                    )

                            silent_chunk = b"\x00" * len(chunk)
                            for sp, q in speaker_queues.items():
                                if sp in speakers:
                                    await q.put(chunk)
                                else:
                                    await q.put(silent_chunk)
                    except Exception:
                        pass
        except (WebSocketDisconnect, RuntimeError, asyncio.CancelledError):
            pass

    recv_task: asyncio.Task | None = None

    try:
        recv_task = asyncio.create_task(receive_loop())

        while True:
            try:
                kind, payload, speaker_id = await asyncio.wait_for(
                    out_queue.get(), timeout=1.0
                )
            except asyncio.TimeoutError:
                continue

            if isinstance(payload, list):
                for seg in payload:
                    seg["speaker"] = speaker_id

            try:
                if kind == "segments":
                    await ws.send_json(
                        {
                            "segments": payload,
                            "is_final": False,
                            "replace": False,
                            "is_partial": False,
                        }
                    )
                elif kind == "partial":
                    await ws.send_json(
                        {
                            "segments": payload,
                            "is_final": False,
                            "replace": False,
                            "is_partial": True,
                        }
                    )
                elif kind == "error":
                    await ws.send_json(
                        {
                            "segments": [
                                {
                                    "speaker": speaker_id,
                                    "text": f"[STT error: {payload}]",
                                }
                            ],
                            "is_final": False,
                            "replace": False,
                        }
                    )
            except (WebSocketDisconnect, RuntimeError):
                break
    except WebSocketDisconnect:
        pass
    finally:
        if recv_task:
            recv_task.cancel()
        for t in speaker_tasks.values():
            if not t.done():
                t.cancel()
        # Drain queues or similar if needed but GC usually handles it once tasks are gone


@app.post("/api/summarize", response_model=SummarizeResponse)
async def summarize_conversation(req: SummarizeRequest):
    """Summarize the full conversation transcript."""
    result = await summarize(req.transcript)
    return SummarizeResponse(**result)


@app.post("/api/chat", response_model=ChatResponse)
async def chat_interaction(req: ChatRequest):
    """Given the transcript context, have an AI respond to a custom prompt."""
    result = await chat_with_llm(req.transcript, req.prompt)
    return ChatResponse(response=result)


@app.post("/api/agent_interject", response_model=AgentInterjectResponse)
async def api_agent_interject(req: AgentInterjectRequest):
    # When conversation is provided, use it as the full context; keep force prefix from transcript
    result = await agent_interject(
        transcript=req.transcript,
        conversation=req.conversation,
    )
    return AgentInterjectResponse(**result)
