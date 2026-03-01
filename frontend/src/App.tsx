import { useState, useCallback } from "react";
import { useAudioCapture } from "./hooks/useAudioCapture";
import { CaptionView } from "./components/CaptionView";
import { SummaryPanel } from "./components/SummaryPanel";

function App() {
  const [captions, setCaptions] = useState<string[]>([]);

  const handleTranscript = useCallback((text: string, _isFinal: boolean) => {
    setCaptions((prev) => [...prev, text]);
  }, []);

  const { isRecording, start, stop } = useAudioCapture(handleTranscript);

  const transcript = captions.join(" ");

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "2rem" }}>
      <h1>Side-Quest</h1>
      <p style={{ color: "#888" }}>Conversation companion for networking</p>

      <div style={{ margin: "1rem 0" }}>
        <button onClick={isRecording ? stop : start}>
          {isRecording ? "Stop Listening" : "Start Listening"}
        </button>
      </div>

      <CaptionView captions={captions} />
      <SummaryPanel transcript={transcript} />
    </div>
  );
}

export default App;
