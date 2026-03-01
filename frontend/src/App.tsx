import { useState, useCallback, useRef, useEffect } from "react";
import { useAudioCapture } from "./hooks/useAudioCapture";
import { CaptionView } from "./components/CaptionView";
import { SummaryPanel } from "./components/SummaryPanel";
import "./App.css";

function App() {
  const [captions, setCaptions] = useState<string[]>([]);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleTranscript = useCallback((text: string, _isFinal: boolean) => {
    setCaptions((prev) => [...prev, text]);
  }, []);

  const { isRecording, error, start, stop } =
    useAudioCapture(handleTranscript);

  useEffect(() => {
    if (isRecording) {
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const transcript = captions.join(" ");

  return (
    <div className="app">
      <header className="header">
        <h1>Cue</h1>
        <div className="header-right">
          <div className="status">
            <span
              className={`status-dot ${isRecording ? "recording" : "ready"}`}
            />
            {isRecording ? `Recording ${formatTime(seconds)}` : "Ready"}
          </div>
          {captions.length > 0 && !isRecording && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setCaptions([])}
            >
              Clear
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={isRecording ? stop : start}
          >
            {isRecording ? "Stop" : "Start Listening"}
          </button>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="main">
        <CaptionView captions={captions} />
        <SummaryPanel transcript={transcript} />
      </div>
    </div>
  );
}

export default App;
