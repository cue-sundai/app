from typing import Callable
import speech_recognition as sr


class Ears:
    """Manages microphone input and background speech transcription."""

    def __init__(
        self,
        on_transcription: Callable[[str], None],
        on_log: Callable[[str], None],
    ):
        self._on_transcription = on_transcription
        self._on_log = on_log
        self._recognizer = sr.Recognizer()
        self._microphone: sr.Microphone | None = None
        self._stop_fn: Callable | None = None

    def start(self):
        """Calibrate the microphone and begin background listening."""
        try:
            self._microphone = sr.Microphone()
            with self._microphone as source:
                self._on_log(
                    "Calibrating microphone for ambient noise... (Please wait)"
                )
                self._recognizer.adjust_for_ambient_noise(source)

            self._on_log("Microphone calibrated. Listening in background...")
            self._stop_fn = self._recognizer.listen_in_background(
                self._microphone, self._audio_callback
            )
        except Exception as e:
            self._on_log(f"[Error] Microphone setup failed: {e}")

    def stop(self):
        """Stop background listening."""
        if self._stop_fn:
            self._stop_fn(wait_for_stop=False)
            self._stop_fn = None

    def _audio_callback(self, recognizer: sr.Recognizer, audio: sr.AudioData):
        try:
            text = recognizer.recognize_google(audio)  # ty: ignore[unresolved-attribute]
            self._on_transcription(f"Transcribed Audio: {text}")
        except sr.UnknownValueError:
            pass
        except sr.RequestError as e:
            self._on_transcription(f"[Error] API unavailable (Check internet): {e}")
