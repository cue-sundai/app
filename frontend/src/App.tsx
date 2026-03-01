import { useState, useCallback, useRef, useEffect } from "react";
import { useAudioCapture, type TranscriptSegment } from "./hooks/useAudioCapture";
import { CaptionView } from "./components/CaptionView";
import { SummaryPanel } from "./components/SummaryPanel";
import { useFaceTracking } from "./hooks/useFaceTracking";
import "./App.css";

function App() {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const segmentsRef = useRef<TranscriptSegment[]>([]);
  useEffect(() => { segmentsRef.current = segments; }, [segments]);

  const [partialSegment, setPartialSegment] = useState<TranscriptSegment | null>(
    null,
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const { faces: activeFaces, isReady: trackerReady } = useFaceTracking(videoRef, { staticFallback: true, distanceThreshold: 0.1 });
  const activeSpeakersRef = useRef<number[]>([0]);
  const [speakerNames, setSpeakerNames] = useState<Record<number, string>>({});
  const cleaningRef = useRef<boolean>(false);

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

  const { isRecording, audioLevel, start, stop, videoStream } =
    useAudioCapture(handleTranscript, activeSpeakersRef);

  const timeoutRef = useRef<number | null>(null);
  const interjectingRef = useRef<boolean>(false);

  const triggerInterjection = useCallback(async (force = false) => {
    if (interjectingRef.current || (!force && segmentsRef.current.length === 0)) return;

    interjectingRef.current = true;
    try {
      const segments = segmentsRef.current;
      const transcriptString = segments
        .map((s) => `[ID:${s.speaker}] ${s.text}`)
        .join("\n");

      // We append a special prefix to the transcript if forced, so the backend LLM knows to DEFINITELY speak
      const payloadTranscript = force ? `[SYSTEM: YOU MUST INTERJECT NOW EVEN IF AWKWARD]\n${transcriptString}` : transcriptString;

      // Send full conversation so the AI has entire context for interject decision
      const res = await fetch(`http://${window.location.hostname}:8820/api/agent_interject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: payloadTranscript,
          conversation: segments.map((s) => ({ speaker: s.speaker, text: s.text })),
        }),
      });

      if (!res.ok) throw new Error("Agent fetch failed");

      const data = await res.json();
      console.log("Interjection response:", data); // Helpful for logging

      if (data.interject && data.audio_b64 && data.text) {
        // Play generated audio
        const snd = new Audio("data:audio/mpeg;base64," + data.audio_b64);
        snd.play();

        // Append AI's text to the transcript
        setSegments(prev => [...prev, { speaker: -1, text: data.text }]);

        // Add the agent to speaker definitions if not present
        setSpeakerNames(prev => ({ ...prev, [-1]: "AI Agent" }));
      } else if (force) {
        console.warn("Forced interjection explicitly bypassed by backend LLM logic", data);
      }
    } catch (e) {
      console.error("Agent Interjection error", e);
    } finally {
      // Prevent frequent back-to-back interjections
      setTimeout(() => {
        interjectingRef.current = false;
      }, 15000);
    }
  }, []);

  useEffect(() => {
    (window as any).forceInterject = () => triggerInterjection(true);
  }, [triggerInterjection]);

  // Agent Interjection Effect based on silence
  useEffect(() => {
    if (!isRecording) {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    if (audioLevel >= 0.005) {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    // Audio is low, start or continue the silence timer
    if (timeoutRef.current === null) {
      timeoutRef.current = window.setTimeout(() => {
        // We reached 5 seconds of silence
        timeoutRef.current = null;
        triggerInterjection(false);
      }, 5000);
    }

    // Cleanup on unmount
    return () => {
      // Don't clear it here otherwise re-renders due to audioLevel updates will reset the timer!
      // The timer correctly gets reset in the `if (audioLevel >= 0.005)` block.
    };
  }, [audioLevel, isRecording, triggerInterjection]);

  useEffect(() => {
    // Determine active speaker based on mouth activity + audio level
    // Lower threshold when audio is present
    const audioThreshold = 0.005;
    const isSpeaking = (face: any) => {
      if (audioLevel > audioThreshold) {
        return face.mouthActivity > 0.04;
      }
      return face.jawOpen > 0.15; // Higher threshold if silent
    };

    const candidates = activeFaces.filter(isSpeaking);

    if (candidates.length > 0) {
      // If audio is high, pick the one with the MOST activity
      if (audioLevel > audioThreshold) {
        const topFace = candidates.reduce((prev, current) =>
          (prev.mouthActivity > current.mouthActivity) ? prev : current
        );
        activeSpeakersRef.current = [topFace.id];
      } else {
        activeSpeakersRef.current = candidates.map(f => f.id);
      }
    }
  }, [activeFaces, audioLevel]);

  // Periodic Cleanup Effect
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;
    if (isRecording) {
      intervalId = setInterval(async () => {
        const liveSegments = segmentsRef.current;
        if (liveSegments.length === 0 || cleaningRef.current) return;

        cleaningRef.current = true;
        const currentBatch = [...liveSegments]; // snapshot what we are cleaning

        const transcriptString = currentBatch
          .map((s) => `[ID:${s.speaker}] ${s.text}`)
          .join("\n");

        if (transcriptString.trim().length === 0) {
          cleaningRef.current = false;
          return;
        }

        try {
          const res = await fetch(`http://${window.location.hostname}:8820/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              transcript: transcriptString,
              prompt: `Review this transcript and the speaker IDs. 
              1. Detect any names mentioned for the speaker IDs (e.g. if ID 1 says "I'm Sarah", then ID 1 is Sarah). 
              2. Clean up the text: fix grammar, add proper punctuation, and remove stutters/fillers while keeping it natural.
              3. Merge adjacent segments from the same speaker if it makes sense.
              
              Return a valid JSON object with:
              - "names": mapping of ID to Name (e.g. {"1": "Sarah"})
              - "segments": array of cleaned segments {speaker: number, text: string}
              
              Return ONLY the JSON. No preamble or markdown.`
            }),
          });

          const data = await res.json();
          const cleanJson = (data.response || "{}").replace(/```json/g, "").replace(/```/g, "").trim();

          try {
            const parsed = JSON.parse(cleanJson);
            if (parsed.names) {
              setSpeakerNames(prev => {
                const newNames = { ...prev };
                for (const [k, v] of Object.entries(parsed.names)) {
                  // prevent overwriting AI agent
                  if (k !== "-1" && Number(k) !== -1) {
                    newNames[Number(k)] = v as string;
                  }
                }
                return newNames;
              });
            }
            if (Array.isArray(parsed.segments)) {
              setSegments(prev => {
                // To avoid losing segments that arrived WHILE we were cleaning:
                // We replace the snapshot history but keep all new segments.
                // We also need to make sure we don't accidentally lose Interjection segments (-1) 
                // that might have been added concurrently.
                const newStuff = prev.slice(currentBatch.length);
                return [...parsed.segments, ...newStuff];
              });
            }
          } catch (e) {
            console.error("Cleanup parse error", e);
          }
        } catch (e) {
          console.error("Cleanup network error", e);
        } finally {
          cleaningRef.current = false;
        }
      }, 20000); // 20s interval
    }
    return () => clearInterval(intervalId);
  }, [isRecording]); // only depend on isRecording to avoid stale closures being problematic with Ref usage

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

  const isFaceSpeaking = (face: any) => {
    const audioThreshold = 0.005;
    if (audioLevel > audioThreshold) {
      return face.mouthActivity > 0.04;
    }
    return face.jawOpen > 0.15;
  };

  return (
    <>
      <header className="header">
        <div className="header-left">
          <span className="header-title">Side-Quest</span>
          <span className={`status-badge ${isRecording ? "recording" : ""}`}>
            <span className="status-dot" />
            {isRecording ? "Listening" : "Idle"}
          </span>
        </div>
        <div className="header-right">
          {isRecording && (
            <button
              className="btn-record"
              style={{ marginRight: "10px", backgroundColor: "#fff", color: "#000" }}
              onClick={() => {
                // We'll define forceInterject as a wrapper function in the component body next
                if ((window as any).forceInterject) {
                  (window as any).forceInterject();
                }
              }}
            >
              Force Interject
            </button>
          )}
          <button
            className={`btn-record ${isRecording ? "active" : ""}`}
            onClick={isRecording ? stop : start}
          >
            {isRecording ? "Stop" : "Start Listening"}
          </button>
        </div>
      </header>

      <main className="dashboard">
        <section className="panel panel-left">
          <div className="panel-header">Live Transcript</div>
          <div className="panel-body">
            {videoStream && (
              <div style={{ marginBottom: "1.5rem", position: "relative", width: "100%" }}>
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
                {activeFaces.map(face => {
                  const speaking = isFaceSpeaking(face);
                  return (
                    <div
                      key={face.id}
                      style={{
                        position: "absolute",
                        left: `${face.box.origin_x * 100}%`,
                        top: `${face.box.origin_y * 100}%`,
                        width: `${face.box.width * 100}%`,
                        height: `${face.box.height * 100}%`,
                        border: `3px solid ${speaking ? "#22c55e" : "#ef4444"}`,
                        borderRadius: 8,
                        boxShadow: speaking ? "0 0 15px #22c55e" : "none",
                        transition: "all 0.1s ease-out",
                        pointerEvents: "none",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        justifyContent: "flex-start"
                      }}
                    >
                      <div style={{
                        background: speaking ? "#22c55e" : "#ef4444",
                        color: "black",
                        fontSize: "10px",
                        fontWeight: "bold",
                        padding: "1px 4px",
                        borderRadius: "0 0 4px 0",
                        textTransform: "uppercase"
                      }}>
                        {speakerNames[face.id] || `ID ${face.id}`}
                        {speaking ? " • SPEAKING" : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <CaptionView segments={displaySegments} names={speakerNames} />
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
