import tkinter as tk
from app import SurveillanceApp

if __name__ == "__main__":
    root = tk.Tk()
    app = SurveillanceApp(root)
    root.protocol("WM_DELETE_WINDOW", app.on_closing)
    root.mainloop()
