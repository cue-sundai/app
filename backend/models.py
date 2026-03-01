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


class AgentInterjectRequest(BaseModel):
    """Full conversation is sent so the AI has entire context for interject decision."""

    transcript: str = ""
    conversation: list[TranscriptSegment] | None = None


class AgentInterjectResponse(BaseModel):
    interject: bool
    text: str | None = None
    audio_b64: str | None = None
