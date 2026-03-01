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
_EMPTY: dict[str, Any] = {"summary": "", "people": [], "topics": [], "action_items": [], "calendar_events": []}


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
        "action_items": out.get("action_items") if isinstance(out.get("action_items"), list) else [],
        "calendar_events": out.get("calendar_events") if isinstance(out.get("calendar_events"), list) else [],
    }


async def _summarize_openai(transcript: str, api_key: str) -> dict[str, Any]:
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=api_key)
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
                    {"role": "user", "content": prompt}
                ]
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
                messages=[{"role": "user", "content": prompt}]
            )
            block = resp.content[0]
            return (getattr(block, "text", "") or "").strip()
        except Exception as e:
            return f"Anthropic error: {e}"

    return "No API Key available."
