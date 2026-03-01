import subprocess

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from models import SummarizeRequest, SummarizeResponse, ActionItem, CalendarEvent
from services.transcriber import transcribe
from services.summarizer import summarize

app = FastAPI(title="Side-Quest API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.websocket("/ws/transcribe")
async def websocket_transcribe(ws: WebSocket):
    """Accept audio chunks over WebSocket and return transcription results."""
    await ws.accept()
    try:
        while True:
            audio_bytes = await ws.receive_bytes()
            text = await transcribe(audio_bytes)
            await ws.send_json({"text": text, "is_final": False})
    except WebSocketDisconnect:
        pass


@app.post("/api/summarize", response_model=SummarizeResponse)
async def summarize_conversation(req: SummarizeRequest):
    """Summarize the full conversation transcript."""
    result = await summarize(req.transcript)
    return SummarizeResponse(**result)


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

        # Build a date string for AppleScript
        # Default to tomorrow at 2pm if no date/time provided
        date_parts = []
        if event.date:
            date_parts.append(event.date)
        if event.time:
            date_parts.append(event.time)
        date_hint = " ".join(date_parts) if date_parts else ""

        # AppleScript: create a 1-hour event on the default calendar
        # Uses a relative date approach — "date string" in AppleScript
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
