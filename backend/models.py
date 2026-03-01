from pydantic import BaseModel


class TranscriptChunk(BaseModel):
    """A single chunk of transcribed speech sent to the client via WebSocket."""

    text: str
    is_final: bool = False


class SummarizeRequest(BaseModel):
    """Request body for the /api/summarize endpoint."""

    transcript: str


class ActionItem(BaseModel):
    """A single action item extracted from a conversation."""

    text: str
    assignee: str | None = None


class CalendarEvent(BaseModel):
    """A calendar event extracted from a conversation."""

    title: str
    date: str | None = None
    time: str | None = None
    attendee: str | None = None


class SummarizeResponse(BaseModel):
    """Structured summary of a conversation."""

    summary: str
    people: list[str]
    topics: list[str]
    action_items: list[ActionItem] = []
    calendar_events: list[CalendarEvent] = []
