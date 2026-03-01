import subprocess
import asyncio
import json
import base64

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from models import (
    SummarizeRequest, SummarizeResponse, ChatRequest, ChatResponse,
    ActionItem, CalendarEvent, CoachRequest, CoachResponse,
    AgentInterjectRequest, AgentInterjectResponse,
)
from services.realtime_stt import run_realtime_session
from services.summarizer import summarize, chat_with_llm, agent_interject
from services.coach import coach_analyze

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
                                            speaker_id=sp
                                        )
                                    )

                            silent_chunk = b'\x00' * len(chunk)
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
                kind, payload, speaker_id = await asyncio.wait_for(out_queue.get(), timeout=1.0)
            except asyncio.TimeoutError:
                continue

            if isinstance(payload, list):
                for seg in payload:
                    seg["speaker"] = speaker_id

            try:
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
                                {"speaker": speaker_id, "text": f"[STT error: {payload}]"}
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


@app.post("/api/coach", response_model=CoachResponse)
async def coach_conversation(req: CoachRequest):
    """Analyze an in-progress conversation for real-time coaching insights."""
    result = await coach_analyze(req.transcript, req.elapsed_seconds)
    return CoachResponse(**result)


@app.post("/api/agent_interject", response_model=AgentInterjectResponse)
async def api_agent_interject(req: AgentInterjectRequest):
    result = await agent_interject(req.transcript)
    return AgentInterjectResponse(**result)


# ── Integration endpoints ──


class RemindersRequest(BaseModel):
    items: list[ActionItem]


@app.post("/api/reminders")
async def add_to_reminders(req: RemindersRequest):
    """Add action items to Apple Reminders via AppleScript."""
    added = 0
    for item in req.items:
        name = item.text
        if item.assignee:
            name += f" ({item.assignee})"
        script = f'''
        tell application "Reminders"
            tell default list
                make new reminder with properties {{name:"{name.replace('"', '\\"')}"}}
            end tell
        end tell
        '''
        result = subprocess.run(
            ["osascript", "-e", script],
            capture_output=True,
            text=True,
        )
        if result.returncode == 0:
            added += 1
    return {"message": f"Added {added} of {len(req.items)} items to Reminders"}


class CalendarRequest(BaseModel):
    events: list[CalendarEvent]


@app.post("/api/calendar")
async def add_to_calendar(req: CalendarRequest):
    """Add calendar events to Apple Calendar via AppleScript."""
    added = 0
    for event in req.events:
        title = event.title
        if event.attendee:
            title += f" (with {event.attendee})"

        date_parts = []
        if event.date:
            date_parts.append(event.date)
        if event.time:
            date_parts.append(event.time)
        date_hint = " ".join(date_parts) if date_parts else ""

        script = f'''
        tell application "Calendar"
            tell calendar "Home"
                set startDate to (current date) + 1 * days
                set hours of startDate to 14
                set minutes of startDate to 0
                set seconds of startDate to 0
                set endDate to startDate + 1 * hours
                make new event with properties {{summary:"{title.replace('"', '\\"')}", start date:startDate, end date:endDate, description:"{date_hint.replace('"', '\\"')}"}}
            end tell
        end tell
        '''
        result = subprocess.run(
            ["osascript", "-e", script],
            capture_output=True,
            text=True,
        )
        if result.returncode == 0:
            added += 1
    return {"message": f"Added {added} of {len(req.events)} events to Calendar"}
