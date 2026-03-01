# Real-Time Conversational AI (Offline Copilot Orchestration)

This project acts as an "Interview Copilot", utilizing a native Python processing pipeline and background Tkinter UI orchestration instead of relying on closed-box cloud agents.

## Architecture & Workflows

To enforce low-latency execution and gain fine-grained programmatic control, this application has transitioned away from the `elevenlabs-conversational-ai` module. Instead of managing a large `websockets` stream to a remote agent, our app natively orchestrates the conversational events locally with complete customizability!

The application consists of three concurrent execution layers operating concurrently alongside the `Tkinter` application's main thread:

1. **VAD (Voice Activity Detection)**: Real-time background thread monitoring audio intensity utilizing `speech_recognition` to capture distinct sentence chunks.
2. **Native API Interaction**: 
    - The VAD bytes are rapidly offloaded to ElevenLabs' native Speech-to-Text (**STT/Scribe**) API utilizing HTTP.
    - AI responses (mocks or LLM calls) are converted natively via Text-to-Speech (**TTS/Multilingual v2**) generating a continuous stream of raw `pcm_16000` audio arrays. This circumvents "Pro" tier `44100Hz` restrictions seamlessly. 
    - The encoded arrays are fed instantly into a built-in `PyAudio` output speaker stream! 
3. **Computer Vision background loop**: A separate background daemon thread manages `cv2.VideoCapture`. It records local webcams at 30 FPS, saving snapshot images (`.jpg`) to the `images/` directory every 5 seconds. This happens entirely friction-free without interrupting the conversation or audio models.

## Dependencies

The project is governed strictly via `uv`.

To set up:
```powershell
uv init
uv venv
```

To install the custom modules:
```powershell
uv add "elevenlabs[pyaudio]" python-dotenv opencv-python speechrecognition numpy pandas
```

### Setup API Key
Create or update an `.env` file within this directory containing your ElevenLabs API Key. 

*(Agent configuration is no longer required!)*

```env
ELEVEN_LABS_API_KEY=your_key_here
```

## Running the Application

Execute via `uv`:
```powershell
uv run python main.py
```

- When the application window launches, press **Start Listen Loop**. 
- Talk directly into your microphone natively. The application will listen for a silence gap, transcribe your text, think, and start natively rendering and speaking Python-defined AI responses. 
- Meanwhile, it will silently capture snapshots from your active WebCam and store them seamlessly within `images/webcam_capture_{id}.jpg`.
