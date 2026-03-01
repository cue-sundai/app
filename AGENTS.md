# Agent Instructions

- **Architecture Strategy**: We are deliberately bypassing ElevenLabs Cloud Agents and WebSocket protocols to enforce low-latency control locally.
- **Microphone VAD**: STT dictation is chunked entirely offline by capturing system microphone pauses using standard python `speech_recognition` module.
- **Native STT/TTS calls**: We execute HTTP requests against ElevenLabs' Scribe API (`client.speech_to_text.convert`) and synthesize return arrays utilizing `pcm_16000` via `client.text_to_speech.convert` to natively support the free-tier.
- **Background Orchestration**: The `copilot_loop` and `webcam_loop` are threaded separately from Tkinter using Python's `threading.Thread(target=..., daemon=True)` and pass signals back to the UI seamlessly using Tkinter's internal Queue structure.

- **Testing**: Always run `uv run test.py` after making any code changes in this project. The script runs automated linting, formatting, and type-checking via Ruff and Ty. Do not finalize your response until all checks pass.
