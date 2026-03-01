"""Conversation summarization service using Claude."""

import json
import os

import anthropic


SYSTEM_PROMPT = """\
You are a conversation analyst for a networking app. Given a conversation transcript, extract structured insights.

Return ONLY valid JSON with this exact schema:
{
  "summary": "2-3 sentence summary of what happened in the conversation",
  "people": ["list", "of", "participant", "first names"],
  "topics": ["list", "of", "key", "topics discussed"],
  "action_items": [
    {"text": "description of the action item", "assignee": "Person name or null if unassigned"}
  ],
  "calendar_events": [
    {"title": "event title", "date": "date if mentioned", "time": "time if mentioned", "attendee": "Person name or null"}
  ]
}

Rules:
- Extract real names from the conversation. Use first names only.
- Action items should be concrete next steps someone committed to.
- Calendar events are specific meetings, calls, or events with a time/date.
- If no action items or calendar events exist, use empty arrays.
- Return ONLY the JSON object, no markdown fences or extra text.
"""


async def summarize(transcript: str) -> dict:
    """Summarize a conversation transcript using Claude.

    Args:
        transcript: Full conversation text to summarize.

    Returns:
        Dict with keys: summary, people, topics, action_items, calendar_events.
    """
    client = anthropic.AsyncAnthropic(
        api_key=os.environ.get("ANTHROPIC_API_KEY"),
    )

    response = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[
            {"role": "user", "content": f"Summarize this conversation:\n\n{transcript}"}
        ],
    )

    text = response.content[0].text
    return json.loads(text)
