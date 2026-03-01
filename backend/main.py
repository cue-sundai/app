from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from models import SummarizeRequest, SummarizeResponse
from services.transcriber import transcribe
from services.summarizer import summarize

app = FastAPI(title="Cue API")

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
