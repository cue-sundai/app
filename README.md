# Cue

Conversation companion for networking — listens live, captions, and summarizes conversations with new people.

## Architecture

```
Browser (mic)  ──WebSocket──▸  FastAPI  ──▸  ElevenLabs STT (placeholder)
                                  │
                                  ▼
                            LLM Summarizer (placeholder)
                                  │
                                  ▼
              React UI  ◂──────  JSON responses
```

## Quick Start

### Backend

```bash
cd backend
uv sync
uv run uvicorn main:app --reload --port 8820
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` — Vite proxies `/api` and `/ws` to the backend.

## API Contract

### WebSocket: `ws://localhost:8820/ws/transcribe`
- Client sends: binary audio chunks (WebM/opus from MediaRecorder)
- Server sends: `{"text": "transcribed words", "is_final": true/false}`

### REST: `POST /api/summarize`
- Request: `{"transcript": "full conversation text"}`
- Response: `{"summary": "...", "people": [...], "topics": [...]}`

## Workstreams

| Area | Key Files |
|------|-----------|
| Backend API + WebSocket | `backend/main.py`, `backend/models.py` |
| ElevenLabs STT | `backend/services/transcriber.py` |
| Frontend UI + audio capture | `frontend/src/` |
| LLM summarization | `backend/services/summarizer.py` |
