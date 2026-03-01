"""Real-time conversation coaching service using Claude."""

import json
import os

import anthropic


COACH_SYSTEM_PROMPT = """\
You are a real-time conversation coach for a networking app. You receive a conversation
transcript that is still in progress. Extract live insights to help the user navigate
the conversation.

Return ONLY valid JSON with this exact schema:
{
  "people": [
    {"name": "First name", "detail": "company or role if mentioned, or null"}
  ],
  "topics": ["topic1", "topic2"],
  "suggested_questions": [
    "A relevant follow-up question the user could ask right now"
  ],
  "nudge": "A brief coaching nudge or null"
}

Rules:
- people: Extract names + any detail (company, role) mentioned so far. First names only.
- topics: Short phrases (2-4 words) for subjects discussed. Max 6 topics.
- suggested_questions: 1-3 contextual questions the user could ask next.
  Make them natural, specific to what's being discussed, and useful for networking.
- nudge: One short encouraging or tactical tip based on the conversation flow, or null.
  Consider the elapsed time. Examples:
  "Great rapport building!" / "Ask about their tech stack" /
  "You've been talking 10+ min — maybe suggest next steps?"
- Return ONLY the JSON object, no markdown fences or extra text.
"""


async def coach_analyze(transcript: str, elapsed_seconds: int = 0) -> dict:
    """Analyze an in-progress conversation for real-time coaching.

    Args:
        transcript: Conversation text so far.
        elapsed_seconds: How long the conversation has been running.

    Returns:
        Dict with keys: people, topics, suggested_questions, nudge.
    """
    client = anthropic.AsyncAnthropic(
        api_key=os.environ.get("ANTHROPIC_API_KEY"),
    )

    user_msg = f"Conversation so far ({elapsed_seconds}s elapsed):\n\n{transcript}"

    response = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=512,
        system=COACH_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    )

    return json.loads(response.content[0].text)
