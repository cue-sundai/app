import { useState, useCallback, useRef, useEffect } from "react";
import { useAudioCapture, type TranscriptSegment } from "./hooks/useAudioCapture";
import { CaptionView } from "./components/CaptionView";
import { SummaryPanel } from "./components/SummaryPanel";
import "./App.css";

function App() {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [partialSegment, setPartialSegment] = useState<TranscriptSegment | null>(
    null,
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const handleTranscript = useCallback(
    (
      newSegments: TranscriptSegment[],
      replace?: boolean,
      isPartial?: boolean,
    ) => {
      if (isPartial) {
        setPartialSegment(newSegments[0] ?? null);
        return;
      }
      setPartialSegment(null);
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

  const displaySegments = [
    ...segments,
    ...(partialSegment ? [partialSegment] : []),
  ];
  const transcript = displaySegments
    .map(
      (s) =>
        `${s.speaker === 0 ? "You" : `Speaker ${s.speaker + 1}`}: ${s.text}`,
    )
    .join(" ");

  return (
    <>
      <header className="header">
        <div className="header-left">
          <span className="header-title">Cue</span>
          <span className={`status-badge ${isRecording ? "recording" : ""}`}>
            <span className="status-dot" />
            {isRecording ? "Recording" : "Idle"}
          </span>
        </div>
        <div className="header-right">
          <button
            className={`btn-record ${isRecording ? "active" : ""}`}
            onClick={isRecording ? stop : start}
          >
            {isRecording ? "Stop" : "Start Listening"}
          </button>
        </div>
      </header>

      <main className="dashboard">
        {videoStream && (
          <section className="panel" style={{ marginBottom: "1rem" }}>
            <div className="panel-header">Camera</div>
            <div className="panel-body" style={{ padding: 0 }}>
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
                  display: "block",
                }}
              />
            </div>
          </section>
        )}

        <section className="panel panel-left">
          <div className="panel-header">Live Transcript</div>
          <div className="panel-body">
            <CaptionView segments={displaySegments} />
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">Conversation Intel</div>
          <div className="panel-body">
            <SummaryPanel transcript={transcript} isRecording={isRecording} />
          </div>
        </section>
      </main>
    </>
  );
}

export default App;
