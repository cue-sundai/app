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


# ── Coach models ──


class PersonEntity(BaseModel):
    """A person detected in the conversation."""

    name: str
    detail: str | None = None


class CoachRequest(BaseModel):
    """Request body for the /api/coach endpoint."""

    transcript: str
    elapsed_seconds: int = 0


class CoachResponse(BaseModel):
    """Real-time coaching insights for an in-progress conversation."""

    people: list[PersonEntity] = []
    topics: list[str] = []
    suggested_questions: list[str] = []
    nudge: str | None = None
