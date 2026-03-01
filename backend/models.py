from pydantic import BaseModel


class TranscriptChunk(BaseModel):
    """A single chunk of transcribed speech sent to the client via WebSocket."""

    text: str
    is_final: bool = False


class SummarizeRequest(BaseModel):
    """Request body for the /api/summarize endpoint."""

    transcript: str


class SummarizeResponse(BaseModel):
    """Structured summary of a conversation."""

    summary: str
    people: list[str]
    topics: list[str]
