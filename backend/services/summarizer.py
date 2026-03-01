"""Conversation summarization service using Claude."""

import json
import os
import re

import anthropic


def _clean_json(text: str) -> str:
    """Strip markdown code fences if Claude wraps the JSON in them."""
    cleaned = re.sub(r"^```(?:json)?\s*", "", text.strip())
    cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned


async def summarize(transcript: str) -> dict:
    """Summarize a conversation transcript using Claude.

    Sends the transcript to Claude and gets back structured JSON with
    summary, people, topics, and action items.

    Args:
        transcript: Full conversation text to summarize.

    Returns:
        Dict with keys: summary, people, topics, action_items.
    """
    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": f"""Analyze this conversation transcript and return a JSON object with exactly these keys:

- "summary": A 2-3 sentence summary of what was discussed
- "people": An array of names of people mentioned or participating
- "topics": An array of topics discussed (e.g. "API Design", "AI Infrastructure")
- "action_items": An array of objects, each with "text" (what needs to be done) and optionally "assignee" (who should do it)

Return ONLY valid JSON, no markdown, no explanation.

Transcript:
{transcript}""",
            }
        ],
    )

    try:
        raw = _clean_json(message.content[0].text)
        result = json.loads(raw)
        # Ensure all expected keys exist
        result.setdefault("summary", "Could not generate summary.")
        result.setdefault("people", [])
        result.setdefault("topics", [])
        result.setdefault("action_items", [])
        return result
    except (json.JSONDecodeError, IndexError):
        return {
            "summary": message.content[0].text[:200] if message.content else "Error generating summary.",
            "people": [],
            "topics": [],
            "action_items": [],
        }
