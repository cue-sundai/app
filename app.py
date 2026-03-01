import os
import time
import tkinter as tk
from tkinter import scrolledtext
from PIL import ImageTk

from eyes import Eyes
from ears import Ears


class SurveillanceApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Webcam & Audio Monitor")
        self.root.geometry("800x650")

        self.running = False

        os.makedirs("output/images", exist_ok=True)
        self._output_txt = f"output/transcription_{time.strftime('%Y%m%d-%H%M%S')}.txt"

        self._eyes = Eyes(output_dir="output/images", save_interval=5.0)
        self._ears = Ears(
            on_transcription=lambda msg: self.root.after(0, self._write_log, msg),
            on_log=lambda msg: self.root.after(0, self._write_log, msg),
        )

        self._imgtk: ImageTk.PhotoImage | None = None

        # --- GUI ---
        self._video_label = tk.Label(self.root)
        self._video_label.pack(pady=10)

        self._text_area = scrolledtext.ScrolledText(
            self.root, wrap=tk.WORD, height=12, width=80
        )
        self._text_area.pack(pady=10)

        btn_frame = tk.Frame(self.root)
        btn_frame.pack(pady=10)

        self._start_btn = tk.Button(
            btn_frame, text="Start Monitor", command=self.start, width=15
        )
        self._start_btn.grid(row=0, column=0, padx=10)

        self._stop_btn = tk.Button(
            btn_frame,
            text="Stop Monitor",
            command=self.stop,
            state=tk.DISABLED,
            width=15,
        )
        self._stop_btn.grid(row=0, column=1, padx=10)

        self._write_log(
            f"System ready. Transcriptions will be saved to: {self._output_txt}"
        )

    # ------------------------------------------------------------------
    # Logging
    # ------------------------------------------------------------------

    def _write_log(self, text: str):
        self._text_area.insert(tk.END, text + "\n")
        self._text_area.see(tk.END)
        with open(self._output_txt, "a", encoding="utf-8") as f:
            f.write(text + "\n")

    # ------------------------------------------------------------------
    # Controls
    # ------------------------------------------------------------------

    def start(self):
        self._start_btn.config(state=tk.DISABLED)
        self._stop_btn.config(state=tk.NORMAL)
        self.running = True
        self._write_log("\n--- Monitoring Started ---")

        if not self._eyes.start():
            self._write_log("[Error] Could not access the webcam.")
            self.stop()
            return

        self._tick()
        self._ears.start()

    def stop(self):
        self.running = False
        self._start_btn.config(state=tk.NORMAL)
        self._stop_btn.config(state=tk.DISABLED)

        self._eyes.stop()
        self._ears.stop()

        self._video_label.configure(image="")
        self._write_log("--- Monitoring Stopped ---")

    def on_closing(self):
        self.stop()
        self.root.destroy()

    # ------------------------------------------------------------------
    # Video loop
    # ------------------------------------------------------------------

    def _tick(self):
        """Called every ~30 ms to pull a frame from Eyes and refresh the display."""
        if not self.running:
            return

        pil_image, saved_path = self._eyes.read_frame()

        if pil_image is not None:
            if saved_path:
                self._write_log(f"Saved Image: {saved_path}")
            self._imgtk = ImageTk.PhotoImage(image=pil_image)
            self._video_label.configure(image=self._imgtk)

        self.root.after(30, self._tick)
