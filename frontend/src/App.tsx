import { useState, useCallback, useRef, useEffect } from "react";
import { useAudioCapture, type TranscriptSegment } from "./hooks/useAudioCapture";
import { CaptionView } from "./components/CaptionView";
import { SummaryPanel } from "./components/SummaryPanel";
import { useFaceTracking } from "./hooks/useFaceTracking";

function App() {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [partialSegment, setPartialSegment] = useState<TranscriptSegment | null>(
    null,
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const { faces: activeFaces, isReady: trackerReady } = useFaceTracking(videoRef, { staticFallback: true, distanceThreshold: 0.1 });
  const activeSpeakersRef = useRef<number[]>([0]);
  const [speakerNames, setSpeakerNames] = useState<Record<number, string>>({});


  useEffect(() => {
    const speakingIds = activeFaces.filter((f) => f.jawOpen > 0.08).map((f) => f.id);
    if (speakingIds.length > 0) {
      activeSpeakersRef.current = speakingIds;
    }
  }, [activeFaces]);

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
    useAudioCapture(handleTranscript, activeSpeakersRef);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;
    if (isRecording) {
      intervalId = setInterval(async () => {
        if (segments.length === 0) return;

        const currentTranscript = segments
          .map((s) => `Speaker ${s.speaker}: ${s.text}`)
          .join(" ");

        try {
          const res = await fetch(`http://${window.location.hostname}:8820/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              transcript: currentTranscript,
              prompt: "Identify the names of the speakers from this transcript if any names have been mentioned. Return ONLY a valid JSON object mapping the speaker number to their identified name, e.g. {\"0\": \"Bob\", \"1\": \"Alice\"}. Do not include markdown or reasoning."
            }),
          });
          const data = await res.json();
          const cleanJson = (data.response || "{}").replace(/```json/g, "").replace(/```/g, "").trim();
          try {
            const parsed = JSON.parse(cleanJson);
            if (typeof parsed === "object" && parsed !== null) {
              setSpeakerNames(prev => ({ ...prev, ...parsed }));
            }
          } catch (e) {
            console.error("Failed to parse speaker names JSON", e);
          }
        } catch (e) {
          // silent fail on network err
        }
      }, 15000);
    }
    return () => clearInterval(intervalId);
  }, [isRecording, segments]);

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
        `${speakerNames[s.speaker] || (s.speaker === 0 ? "You" : `Speaker ${s.speaker}`)}: ${s.text}`,
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
        <div style={{ marginBottom: "1rem", position: "relative", width: "100%", maxWidth: 640 }}>
          {!trackerReady && (
            <div style={{
              position: "absolute",
              top: 10,
              right: 10,
              background: "rgba(0,0,0,0.7)",
              color: "white",
              padding: "4px 8px",
              borderRadius: "4px",
              fontSize: "12px",
              zIndex: 10
            }}>
              Loading AI Face Tracker...
            </div>
          )}
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{
              width: "100%",
              borderRadius: 8,
              background: "#111",
              display: "block"
            }}
          />
          {activeFaces.map(face => (
            <div
              key={face.id}
              style={{
                position: "absolute",
                left: `${face.box.origin_x * 100}%`,
                top: `${face.box.origin_y * 100}%`,
                width: `${face.box.width * 100}%`,
                height: `${face.box.height * 100}%`,
                border: `3px solid ${face.jawOpen > 0.08 ? "lime" : "red"}`,
                borderRadius: 8,
                boxShadow: face.jawOpen > 0.08 ? "0 0 15px lime" : "none",
                transition: "all 0.1s ease-out",
                pointerEvents: "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                justifyContent: "flex-start"
              }}
            >
              <div style={{
                background: face.jawOpen > 0.08 ? "lime" : "red",
                color: "black",
                fontSize: "12px",
                fontWeight: "bold",
                padding: "2px 6px",
                borderRadius: "0 0 4px 0",
                textTransform: "uppercase"
              }}>
                {speakerNames[face.id] || `ID ${face.id}`}
                {face.jawOpen > 0.08 ? " • SPEAKING" : ""}
              </div>
            </div>
          ))}
        </div>
      )}

      <CaptionView segments={displaySegments} names={speakerNames} />
      <SummaryPanel transcript={transcript} isRecording={isRecording} />
    </div>
  );
}

export default App;
