import os
import subprocess

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from models import SummarizeRequest, SummarizeResponse, ActionItem
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


class IntegrationRequest(BaseModel):
    items: list[ActionItem]


@app.post("/api/reminders")
async def add_to_reminders(req: IntegrationRequest):
    """Add action items to Apple Reminders via AppleScript."""
    added = 0
    for item in req.items:
        name = item.text
        if item.assignee:
            name += f" ({item.assignee})"
        # AppleScript to create a reminder in the default list
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


@app.post("/api/notion")
async def push_to_notion(req: IntegrationRequest):
    """Push action items to a Notion database."""
    import httpx

    notion_key = os.environ.get("NOTION_API_KEY")
    database_id = os.environ.get("NOTION_DATABASE_ID")

    if not notion_key or not database_id:
        return {"message": "Notion not configured — set NOTION_API_KEY and NOTION_DATABASE_ID env vars"}

    headers = {
        "Authorization": f"Bearer {notion_key}",
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
    }

    added = 0
    async with httpx.AsyncClient() as client:
        for item in req.items:
            body = {
                "parent": {"database_id": database_id},
                "properties": {
                    "Name": {"title": [{"text": {"content": item.text}}]},
                    "Assignee": {"rich_text": [{"text": {"content": item.assignee or ""}}]},
                },
            }
            resp = await client.post(
                "https://api.notion.com/v1/pages",
                headers=headers,
                json=body,
            )
            if resp.status_code == 200:
                added += 1

    return {"message": f"Pushed {added} of {len(req.items)} items to Notion"}
