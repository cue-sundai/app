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
        "summary": f"[mock summary] Conversation with {len(transcript.split())} words.",
        "people": ["Person A", "Person B"],
        "topics": ["introductions", "networking"],
    }
