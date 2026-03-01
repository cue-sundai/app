import time
import cv2
from PIL import Image


class Eyes:
    """Manages webcam capture and periodic frame saving to disk."""

    def __init__(self, output_dir: str = "output/images", save_interval: float = 5.0):
        self.output_dir = output_dir
        self.save_interval = save_interval
        self._cap: cv2.VideoCapture | None = None
        self._last_save_time: float = 0.0

    def start(self) -> bool:
        """Open the webcam. Returns True if the device was successfully opened."""
        self._cap = cv2.VideoCapture(0)
        self._last_save_time = time.time()
        return self._cap.isOpened()

    def read_frame(self) -> tuple[Image.Image | None, str | None]:
        """Read one frame from the webcam.

        Returns a tuple of:
          - PIL Image ready for display (or None if the read failed)
          - Path of the saved JPEG if a frame was written to disk this call, else None
        """
        if self._cap is None:
            return None, None

        ret, frame = self._cap.read()
        if not ret:
            return None, None

        saved_path: str | None = None
        now = time.time()
        if now - self._last_save_time >= self.save_interval:
            saved_path = f"{self.output_dir}/frame_{int(now)}.jpg"
            cv2.imwrite(saved_path, frame)
            self._last_save_time = now

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGBA)
        return Image.fromarray(rgb), saved_path

    def stop(self):
        """Release the webcam device."""
        if self._cap:
            self._cap.release()
            self._cap = None
