"""Conversation summarization service.

TODO: Replace mock with LLM integration (OpenAI, Anthropic, etc.).
"""


async def summarize(transcript: str) -> dict:
    """Summarize a conversation transcript.

    Args:
        transcript: Full conversation text to summarize.

    Returns:
        Dict with keys: summary, people, topics.
    """
    # --- PLACEHOLDER ---
    # Replace with LLM call, e.g.:
    #   from openai import AsyncOpenAI
    #   client = AsyncOpenAI()
    #   response = await client.chat.completions.create(
    #       model="gpt-4o",
    #       messages=[{"role": "user", "content": f"Summarize this conversation: {transcript}"}],
    #   )
    #   parsed = json.loads(response.choices[0].message.content)
    #   return parsed
    return {
        "summary": "Sarah from Stripe and Alex from Vercel connected at a networking event. They discussed API versioning challenges, deployment pipelines, and an upcoming AI infrastructure panel. They agreed to follow up with shared resources and schedule a call.",
        "people": ["Sarah", "Alex"],
        "topics": ["API Design", "Deployment Pipelines", "AI Infrastructure", "Versioning"],
        "action_items": [
            {"text": "Send calendar invite for Thursday call", "assignee": "Sarah"},
            {"text": "Share API versioning docs", "assignee": "Sarah"},
            {"text": "Send notes from Anthropic talk", "assignee": "Alex"},
            {"text": "Follow up with deployment docs", "assignee": "Alex"},
            {"text": "Compare versioning approaches"},
        ],
        "calendar_events": [
            {"title": "Versioning deep-dive call", "date": "Thursday", "time": "afternoon", "attendee": "Sarah"},
            {"title": "AI Infrastructure panel", "date": "today", "time": "later", "attendee": "Alex"},
        ],
    }
