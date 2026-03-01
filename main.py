import os
import time
import tkinter as tk
from tkinter import scrolledtext
from PIL import Image, ImageTk
import cv2
import speech_recognition as sr


class SurveillanceApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Webcam & Audio Monitor")
        self.root.geometry("800x650")

        self.running = False
        self.cap = None
        self.last_img_time = time.time()
        self.recognizer = sr.Recognizer()
        self.stop_listening_fn = None
        self.microphone = None

        # Ensure output directories exist
        os.makedirs("output/images", exist_ok=True)
        # Create a unique text file based on the program startup time
        self.output_txt = f"output/transcription_{time.strftime('%Y%m%d-%H%M%S')}.txt"

        # --- GUI Elements Setup ---

        # Label to display the webcam feed
        self.video_label = tk.Label(self.root)
        self.video_label.pack(pady=10)

        # Log and Transcription area
        self.text_area = scrolledtext.ScrolledText(
            self.root, wrap=tk.WORD, height=12, width=80
        )
        self.text_area.pack(pady=10)

        # Buttons
        self.btn_frame = tk.Frame(self.root)
        self.btn_frame.pack(pady=10)

        self.start_btn = tk.Button(
            self.btn_frame, text="Start Monitor", command=self.start, width=15
        )
        self.start_btn.grid(row=0, column=0, padx=10)

        self.stop_btn = tk.Button(
            self.btn_frame,
            text="Stop Monitor",
            command=self.stop,
            state=tk.DISABLED,
            width=15,
        )
        self.stop_btn.grid(row=0, column=1, padx=10)

        self.write_log(
            f"System ready. Transcriptions will be saved to: {self.output_txt}"
        )

    def write_log(self, text):
        """Helper to safely write to the UI log and the output text file"""
        self.text_area.insert(tk.END, text + "\n")
        self.text_area.see(tk.END)
        with open(self.output_txt, "a", encoding="utf-8") as f:
            f.write(text + "\n")

    def audio_callback(self, recognizer, audio):
        """This function is called automatically in a background thread when a phrase triggers it"""
        try:
            # We use Google's free Speech Recognition API for simplicity.
            # Without internet, you'd need local libraries like pocketsphinx or whisper.
            text = recognizer.recognize_google(audio)

            # Update GUI from background thread safely via `after_idle` or scheduling
            # `self.root.after()` schedules the call on the main GUI thread.
            self.root.after(0, self.write_log, f"Transcribed Audio: {text}")
        except sr.UnknownValueError:
            pass  # Ignored unintelligible audio
        except sr.RequestError as e:
            self.root.after(
                0, self.write_log, f"[Error] API unavailable (Check internet): {e}"
            )

    def start(self):
        """Starts webcam and background audio listening threads"""
        self.start_btn.config(state=tk.DISABLED)
        self.stop_btn.config(state=tk.NORMAL)
        self.running = True
        self.write_log("\n--- Monitoring Started ---")

        # 1. Start Webcam Video Capture
        self.cap = cv2.VideoCapture(0)
        if not self.cap.isOpened():
            self.write_log("[Error] Could not access the webcam.")
            self.stop()
            return

        self.last_img_time = time.time()
        self.update_frame()

        # 2. Start Audio Thread
        try:
            self.microphone = sr.Microphone()
            with self.microphone as source:
                self.write_log(
                    "Calibrating microphone for ambient noise... (Please wait)"
                )
                self.recognizer.adjust_for_ambient_noise(source)

            self.write_log("Microphone calibrated. Listening in background...")
            # `listen_in_background` spawns a daemon thread indefinitely reading microphone data
            self.stop_listening_fn = self.recognizer.listen_in_background(
                self.microphone, self.audio_callback
            )
        except Exception as e:
            self.write_log(f"[Error] Microphone setup failed: {e}")

    def update_frame(self):
        """Reads frame, saves every 5s, updates GUI"""
        if not self.running or self.cap is None:
            return

        ret, frame = self.cap.read()
        if ret:
            # Save frame to disk every 5 seconds
            current_time = time.time()
            if current_time - self.last_img_time >= 5.0:
                img_path = f"output/images/frame_{int(current_time)}.jpg"
                cv2.imwrite(img_path, frame)
                self.write_log(f"Saved Image: {img_path}")
                self.last_img_time = current_time

            # Convert OpenCV frame (BGR) to Tkinter friendly format (RGBA)
            cv2image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGBA)
            img = Image.fromarray(cv2image)
            self.imgtk = ImageTk.PhotoImage(
                image=img
            )  # Keep reference to avoid garbage collection
            self.video_label.configure(image=self.imgtk)

        # Call update_frame again after 30 ms (target ~30 fps)
        self.root.after(30, self.update_frame)

    def stop(self):
        """Stops active threads and clears video"""
        self.running = False
        self.start_btn.config(state=tk.NORMAL)
        self.stop_btn.config(state=tk.DISABLED)

        if self.cap:
            self.cap.release()

        if self.stop_listening_fn:
            self.stop_listening_fn(wait_for_stop=False)

        self.video_label.configure(image="")
        self.write_log("--- Monitoring Stopped ---")

    def on_closing(self):
        self.stop()
        self.root.destroy()


if __name__ == "__main__":
    root = tk.Tk()
    app = SurveillanceApp(root)
    # Ensure camera/audio is released neatly on 'X' press
    root.protocol("WM_DELETE_WINDOW", app.on_closing)
    root.mainloop()
