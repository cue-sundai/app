import io
import os
import queue
import threading
import time
import tkinter as tk
from tkinter import ttk
from typing import Optional

import cv2
import pyaudio
import speech_recognition as sr
from dotenv import load_dotenv

# ElevenLabs standard STT/TTS API
from elevenlabs.client import ElevenLabs

# Load environment variables (e.g., ELEVEN_LABS_API_KEY) from .env
load_dotenv()

API_KEY = os.environ.get("ELEVEN_LABS_API_KEY") or os.environ.get("ELEVENLABS_API_KEY")


class NativeCopilotApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Native STT/TTS Copilot with Vision")
        self.root.geometry("500x350")

        # Thread-safe queue for routing messages from background workers to the Tkinter UI thread
        self.message_queue: queue.Queue = queue.Queue()
        self.copilot_running = False

        # Tkinter variables
        self.status_var = tk.StringVar(value="Status: Disconnected")
        self.transcript_var = tk.StringVar(value="Click 'Start Listen Loop' to begin.")

        # Build UI layout
        ttk.Label(
            self.root,
            text="Native Copilot Orchestrator",
            font=("Helvetica", 16, "bold"),
        ).pack(pady=10)

        self.status_label = ttk.Label(
            self.root, textvariable=self.status_var, font=("Helvetica", 12)
        )
        self.status_label.pack(pady=5)

        self.transcript_label = ttk.Label(
            self.root,
            textvariable=self.transcript_var,
            font=("Helvetica", 10, "italic"),
            wraplength=450,
        )
        self.transcript_label.pack(pady=5)

        self.start_button = ttk.Button(
            self.root, text="Start Listen Loop", command=self.start_copilot
        )
        self.start_button.pack(pady=10)

        self.stop_button = ttk.Button(
            self.root, text="Stop", command=self.stop_copilot, state=tk.DISABLED
        )
        self.stop_button.pack(pady=10)

        # Initialize clients using native API key injection
        self.client = ElevenLabs(api_key=API_KEY)
        self.recognizer = sr.Recognizer()

        # Start Tkinter mainloop listener to execute background UI tasks
        self._process_queue()

    def _process_queue(self) -> None:
        """Polls the thread-safe queue periodically on the Tkinter main thread."""
        try:
            while True:
                task = self.message_queue.get_nowait()
                task()
                self.message_queue.task_done()
        except queue.Empty:
            pass
        finally:
            self.root.after(100, self._process_queue)

    def _sync_ui_update(
        self,
        status: Optional[str] = None,
        transcript: Optional[str] = None,
        append: Optional[str] = None,
    ) -> None:
        """Helper to thread-safely insert GUI assignments."""
        if status is not None:
            self.message_queue.put(lambda: self.status_var.set(f"Status: {status}"))
        if transcript is not None:
            self.message_queue.put(lambda: self.transcript_var.set(transcript))
        if append is not None:
            self.message_queue.put(
                lambda: self.transcript_var.set(self.transcript_var.get() + append)
            )

    def _webcam_loop(self) -> None:
        """Background daemon sequence handling periodic webcam captures."""
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            self._sync_ui_update(append="\n[Warning: Could not open webcam]")
            return

        os.makedirs("images", exist_ok=True)
        img_counter = 0
        last_save = time.time()

        while self.copilot_running:
            ret, frame = cap.read()
            if not ret:
                time.sleep(0.1)
                continue

            # Periodically save an image (e.g., every 5 seconds)
            if time.time() - last_save > 5.0:
                filename = f"images/webcam_capture_{img_counter}.jpg"
                cv2.imwrite(filename, frame)
                self._sync_ui_update(append=f"\n[Saved {filename}]")
                last_save = time.time()
                img_counter += 1

            time.sleep(0.03)  # Yield CPU slightly to hit roughly ~30 FPS loop

        cap.release()

    def _copilot_loop(self) -> None:
        """
        Background daemon sequence:
        1. VAD Microphone Listen ->
        2. ElevenLabs STT ('Scribe') ->
        3. LLM Orchestration Logic (Python) ->
        4. ElevenLabs TTS ->
        5. PyAudio execution
        """
        self._sync_ui_update(status="Initializing Microphone...")

        with sr.Microphone() as source:
            # Adjust to ambient background noise gracefully
            self.recognizer.adjust_for_ambient_noise(source, duration=1.0)

            while self.copilot_running:
                try:
                    # 1. Capture Audio via VAD - blocks until silence detected or phrase limit hit
                    self._sync_ui_update(status="Listening for speech...")
                    audio = self.recognizer.listen(
                        source, timeout=1, phrase_time_limit=15
                    )

                    self._sync_ui_update(status="Transcribing via ElevenLabs STT...")

                    # 2. ElevenLabs STT natively via `speech_to_text.convert`
                    audio_bytes = audio.get_wav_data()
                    audio_io = io.BytesIO(audio_bytes)
                    audio_io.name = (
                        "audio.wav"  # Scribe API necessitates a 'name' attribute
                    )

                    stt_response = self.client.speech_to_text.convert(
                        file=audio_io, model_id="scribe_v1"
                    )

                    user_text = stt_response.text
                    if not user_text.strip():
                        continue

                    self._sync_ui_update(
                        status="Thinking...", transcript=f"You: {user_text}"
                    )

                    # 3. Native Python Mock Logic. Replace with real LLM calls here natively!
                    ai_response = f"Testing response. I heard you say: {user_text}."

                    self._sync_ui_update(
                        status="Speaking via ElevenLabs TTS...",
                        transcript=f"AI: {ai_response}",
                    )

                    # 4. Synthesize TTS natively fetching PyAudio ready RAW format
                    # USING pcm_16000 WHICH IS ALLOWED ON FREE TIERS
                    audio_stream = self.client.text_to_speech.convert(
                        voice_id="JBFqnCBsd6RMkjVDRZzb",
                        text=ai_response,
                        model_id="eleven_multilingual_v2",
                        output_format="pcm_16000",
                    )

                    # 5. Play raw 16kHz PCM 16-bit audio stream sequentially
                    p = pyaudio.PyAudio()
                    stream = p.open(
                        format=pyaudio.paInt16, channels=1, rate=16000, output=True
                    )

                    for chunk in audio_stream:
                        if not self.copilot_running:
                            break
                        if chunk:
                            stream.write(chunk)

                    stream.stop_stream()
                    stream.close()
                    p.terminate()

                except sr.WaitTimeoutError:
                    # Occurs if `timeout=1` lapses and no speech is found yet.
                    continue
                except Exception as e:
                    print(f"Pipeline Loop Exception: {e}")
                    self._sync_ui_update(status=f"Error: {e}")
                    self.copilot_running = False
                    break

        self._sync_ui_update(status="Copilot Stopped")
        self.message_queue.put(lambda: self.start_button.config(state=tk.NORMAL))
        self.message_queue.put(lambda: self.stop_button.config(state=tk.DISABLED))

    def start_copilot(self):
        """Initializes the background daemon loops and kicks off the orchestration."""
        if self.copilot_running:
            return
        self.copilot_running = True
        self.start_button.config(state=tk.DISABLED)
        self.stop_button.config(state=tk.NORMAL)

        # Start both the main STT/TTS loop and the webcam capture thread concurrently
        threading.Thread(target=self._copilot_loop, daemon=True).start()
        threading.Thread(target=self._webcam_loop, daemon=True).start()

    def stop_copilot(self):
        """Signals the loop to conclude its active cycle gracefully."""
        self.status_var.set("Status: Stopping...")
        self.copilot_running = False

    def on_closing(self):
        """Safely clean up resources if window explicitly closed."""
        self.copilot_running = False
        self.root.destroy()


if __name__ == "__main__":
    root = tk.Tk()
    app = NativeCopilotApp(root)
    root.protocol("WM_DELETE_WINDOW", app.on_closing)
    root.mainloop()
