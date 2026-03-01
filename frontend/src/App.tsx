import { useState, useCallback, useRef, useEffect } from "react";
import { useAudioCapture, type TranscriptSegment } from "./hooks/useAudioCapture";
import { CaptionView } from "./components/CaptionView";
import { SummaryPanel } from "./components/SummaryPanel";

function App() {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const handleTranscript = useCallback(
    (newSegments: TranscriptSegment[], replace?: boolean) => {
      if (replace) {
        setSegments(newSegments);
      } else {
        setSegments((prev) => [...prev, ...newSegments]);
      }
    },
    [],
  );

  const { isRecording, start, stop, videoStream } =
    useAudioCapture(handleTranscript);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !videoStream) return;
    v.srcObject = videoStream;
    return () => {
      v.srcObject = null;
    };
  }, [videoStream]);

  const transcript = segments
    .map(
      (s) =>
        `${s.speaker === 0 ? "You" : `Speaker ${s.speaker + 1}`}: ${s.text}`,
    )
    .join(" ");

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "2rem" }}>
      <h1>Side-Quest</h1>
      <p style={{ color: "#888" }}>
        Conversation companion for networking
      </p>

      <div style={{ margin: "1rem 0" }}>
        <button onClick={isRecording ? stop : start}>
          {isRecording ? "Stop Listening" : "Start Listening"}
        </button>
      </div>

      {videoStream && (
        <div style={{ marginBottom: "1rem" }}>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{
              width: "100%",
              maxWidth: 640,
              borderRadius: 8,
              background: "#111",
            }}
          />
        </div>
      )}

      <CaptionView segments={segments} />
      <SummaryPanel transcript={transcript} isRecording={isRecording} />
    </div>
  );
}

export default App;
