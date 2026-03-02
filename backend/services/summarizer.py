"""Conversation summarization via OpenAI or Anthropic.

Uses OPENAI_API_KEY or ANTHROPIC_API_KEY from the environment.
Returns summary, people, topics, action_items, and calendar_events for the frontend.
"""

import json
import os
import re
from typing import Any


_SUMMARY_PROMPT = """\
Analyze this conversation transcript and respond with a single JSON object (no markdown, no code block) with exactly these keys:
- "summary": string, 2-4 sentences summarizing what was discussed and any outcomes.
- "people": array of strings, names or identifiers of people mentioned or implied (e.g. "Sarah", "the interviewer"). Use empty array if none.
- "topics": array of strings, main topics or themes (e.g. "project timeline", "budget"). Use empty array if none.
- "action_items": array of objects with keys "text" (description of the action item) and "assignee" (person name or null if unassigned). These are concrete next steps someone committed to. Use empty array if none.
- "calendar_events": array of objects with keys "title", "date" (if mentioned, else null), "time" (if mentioned, else null), "attendee" (person name or null). These are specific meetings, calls, or events with a time/date. Use empty array if none.

Transcript:
"""
_EMPTY: dict[str, Any] = {
    "summary": "",
    "people": [],
    "topics": [],
    "action_items": [],
    "calendar_events": [],
}


def _parse_json_from_response(text: str) -> dict[str, Any]:
    """Extract JSON object from LLM response, with fallback."""
    text = text.strip()
    # Strip markdown code block if present
    if "```" in text:
        match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
        if match:
            text = match.group(1).strip()
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass
    return _EMPTY


def _normalize_result(out: dict[str, Any]) -> dict[str, Any]:
    """Normalize LLM output to expected schema."""
    return {
        "summary": out.get("summary", "") or "No summary generated.",
        "people": out.get("people") if isinstance(out.get("people"), list) else [],
        "topics": out.get("topics") if isinstance(out.get("topics"), list) else [],
        "action_items": out.get("action_items")
        if isinstance(out.get("action_items"), list)
        else [],
        "calendar_events": out.get("calendar_events")
        if isinstance(out.get("calendar_events"), list)
        else [],
    }


async def _summarize_openai(transcript: str, api_key: str) -> dict[str, Any]:
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=api_key)
    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "user",
                    "content": _SUMMARY_PROMPT + (transcript or "(no transcript)"),
                }
            ],
            max_tokens=1024,
        )
        content = (response.choices[0].message.content or "").strip()
        out = _parse_json_from_response(content)
        return _normalize_result(out)
    except Exception as e:
        return {**_EMPTY, "summary": f"OpenAI error: {e}"}


async def _summarize_anthropic(transcript: str, api_key: str) -> dict[str, Any]:
    from anthropic import AsyncAnthropic

    client = AsyncAnthropic(api_key=api_key)
    try:
        response = await client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=[
                {
                    "role": "user",
                    "content": _SUMMARY_PROMPT + (transcript or "(no transcript)"),
                }
            ],
        )
        block = response.content[0]
        content = (getattr(block, "text", "") or "").strip()
        out = _parse_json_from_response(content)
        return _normalize_result(out)
    except Exception as e:
        return {
            "summary": f"Anthropic error: {e}",
            "people": [],
            "topics": [],
            "action_items": [],
            "calendar_events": [],
        }


async def summarize(transcript: str) -> dict[str, Any]:
    """Summarize a conversation transcript using OpenAI or Anthropic.

    Returns dict with keys: summary, people, topics, action_items, calendar_events.
    """
    openai_key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    anthropic_key = (os.environ.get("ANTHROPIC_API_KEY") or "").strip()

    if openai_key:
        return await _summarize_openai(transcript, openai_key)
    if anthropic_key:
        return await _summarize_anthropic(transcript, anthropic_key)

    return {
        "summary": "No OPENAI_API_KEY or ANTHROPIC_API_KEY set. Add one to backend/.env.",
        "people": [],
        "topics": [],
        "action_items": [],
        "calendar_events": [],
    }


async def chat_with_llm(transcript: str, prompt: str) -> str:
    """Chat interactively with the transcript using an LLM."""
    openai_key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    anthropic_key = (os.environ.get("ANTHROPIC_API_KEY") or "").strip()

    sys_prompt = f"You are a helpful assistant assisting a user during a real-life context. Rely on the following live transcript as context:\n\nTRANSCRIPT:\n{transcript}"

    if openai_key:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=openai_key)
        try:
            resp = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": sys_prompt},
                    {"role": "user", "content": prompt},
                ],
            )
            return (resp.choices[0].message.content or "").strip()
        except Exception as e:
            return f"OpenAI error: {e}"

    if anthropic_key:
        from anthropic import AsyncAnthropic

        client = AsyncAnthropic(api_key=anthropic_key)
        try:
            resp = await client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1024,
                system=sys_prompt,
                messages=[{"role": "user", "content": prompt}],
            )
            block = resp.content[0]
            return (getattr(block, "text", "") or "").strip()
        except Exception as e:
            return f"Anthropic error: {e}"

    return "No API Key available."


async def agent_interject(
    transcript: str,
    conversation: list[Any] | None = None,
) -> dict[str, Any]:
    """Decide whether to speak and generate TTS audio. Uses full conversation as context."""
    import httpx

    openai_key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    anthropic_key = (os.environ.get("ANTHROPIC_API_KEY") or "").strip()
    eleven_labs_key = (os.environ.get("ELEVEN_LABS_API_KEY") or "").strip()

    if not (openai_key or anthropic_key) or not eleven_labs_key:
        return {"interject": False}

    force_interject = "[SYSTEM: YOU MUST INTERJECT NOW EVEN IF AWKWARD]" in transcript

    # Build full conversation transcript: prefer explicit conversation list so the AI gets entire context
    if conversation:
        clean_transcript = "\n".join(
            f"[ID:{s.speaker}] {s.text}"
            for s in conversation
            if getattr(s, "speaker", None) is not None and getattr(s, "text", "")
        )
    else:
        clean_transcript = transcript.replace(
            "[SYSTEM: YOU MUST INTERJECT NOW EVEN IF AWKWARD]\n", ""
        )

    base_instruction = """You are an AI participant in a live meeting. The conversation has paused for a few seconds.
Below is the COMPLETE conversation from the start of the meeting. Use the ENTIRE conversation as context to decide whether to interject and what to say.
If there's a somewhat relevant, insightful question or short comment you'd like to make to contribute to the discussion, respond with "interject": true and your "text". Keep it conversational, brief (under 2 sentences), and natural. If you have nothing important to add, set "interject": false."""

    force_instruction = """You are an AI participant in a live meeting. The user has EXPLICITLY COMMANDED you to interject.
Below is the COMPLETE conversation so far. Use the ENTIRE conversation as context. You MUST respond with "interject": true and provide a "text" response. Say something highly relevant to the conversation, or if the transcript is empty, quickly introduce yourself. Keep it conversational, brief (under 2 sentences), and natural. YOU MUST NOT RETURN interject: false."""

    prompt = f"""{force_instruction if force_interject else base_instruction}

Full conversation transcript:
{clean_transcript.strip() or "(No conversation yet)"}

Return ONLY valid JSON:
{{
  "interject": {"true" if force_interject else "boolean"},
  "text": "your response here"
}}"""

    content = ""
    # Try OpenAI first
    if openai_key:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=openai_key)
        try:
            resp = await client.chat.completions.create(
                model="gpt-4o-mini", messages=[{"role": "user", "content": prompt}]
            )
            content = (resp.choices[0].message.content or "").strip()
        except Exception as e:
            print(f"OpenAI error in interject: {e}")

    if not content and anthropic_key:
        from anthropic import AsyncAnthropic

        client = AsyncAnthropic(api_key=anthropic_key)
        try:
            resp = await client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=256,
                messages=[{"role": "user", "content": prompt}],
            )
            block = resp.content[0]
            content = (getattr(block, "text", "") or "").strip()
        except Exception as e:
            print(f"Anthropic error in interject: {e}")

    print(f"LLM Response text: {content}")
    out = _parse_json_from_response(content)
    print(f"Parsed parsed JSON: {out}")

    interject = bool(out.get("interject", False))
    text = out.get("text") or ""

    if not interject or not text.strip():
        print("Returning because interject=False or text is empty")
        return {"interject": False}

    # Generate TTS
    try:
        # We use a default voice ID for ElevenLabs
        import base64

        voice_id = "21m00Tcm4TlvDq8ikWAM"  # "Rachel" default voice
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"

        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": eleven_labs_key,
        }

        data = {
            "text": text,
            "model_id": "eleven_monolingual_v1",
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.5},
        }

        async with httpx.AsyncClient() as client:
            tts_resp = await client.post(url, json=data, headers=headers)
            tts_resp.raise_for_status()
            audio_bytes = tts_resp.content

        b64_audio = base64.b64encode(audio_bytes).decode("utf-8")

        return {"interject": True, "text": text, "audio_b64": b64_audio}
    except Exception as e:
        print(f"TTS Error: {e}")
        # Still return the text even if TTS fails — frontend will show it without audio
        return {"interject": True, "text": text, "audio_b64": None}
