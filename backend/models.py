from pydantic import BaseModel


class TranscriptSegment(BaseModel):
    """One speaker segment in a transcription."""

    speaker: int
    text: str


class TranscriptChunk(BaseModel):
    """Transcription result sent to the client via WebSocket."""

    segments: list[TranscriptSegment]
    is_final: bool = False


class SummarizeRequest(BaseModel):
    """Request body for the /api/summarize endpoint."""

    transcript: str


class SummarizeResponse(BaseModel):
    """Structured summary of a conversation."""

    summary: str
    people: list[str]
    topics: list[str]

class ChatRequest(BaseModel):
    transcript: str
    prompt: str

class ChatResponse(BaseModel):
    response: str
