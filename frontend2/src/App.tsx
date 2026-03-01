import { useState, useCallback, useRef } from "react";
import { useAudioCapture } from "./hooks/useAudioCapture";
import { CaptionView } from "./components/CaptionView";
import { SummaryPanel } from "./components/SummaryPanel";
import "./App.css";

const DEMO_LINES = [
  "Hey, nice to meet you! I'm Sarah from the product team at Stripe.",
  "Great to meet you too! I'm Alex, I work on developer tools at Vercel.",
  "Oh cool, what kind of tools are you building?",
  "Mostly around deployment pipelines and edge functions. What about you?",
  "I'm leading our new API design initiative. We're rethinking how we do versioning.",
  "That's really interesting. We ran into versioning headaches last quarter.",
  "Yeah it's a common pain point. We should compare notes sometime.",
  "Definitely. Are you going to the AI infrastructure panel later today?",
  "Yes! I heard the speaker from Anthropic is talking about tool use patterns.",
  "I'll send you my notes from their last talk. Can I get your email?",
  "Sure, it's alex@vercel.com. I'll follow up with the deployment docs too.",
  "Perfect. Let's also schedule a call next week to dig into the versioning stuff.",
  "Sounds great. Maybe Wednesday or Thursday afternoon?",
  "Thursday works. I'll send a calendar invite.",
  "Awesome. Really glad we connected!",
];

function App() {
  const [captions, setCaptions] = useState<string[]>([]);
  const [demoing, setDemoing] = useState(false);
  const demoTimer = useRef<number | null>(null);
  const demoIndex = useRef(0);

  const handleTranscript = useCallback((text: string, _isFinal: boolean) => {
    setCaptions((prev) => [...prev, text]);
  }, []);

  const { isRecording, start, stop } = useAudioCapture(handleTranscript);

  function startDemo() {
    setCaptions([]);
    setDemoing(true);
    demoIndex.current = 0;
    demoTimer.current = window.setInterval(() => {
      const idx = demoIndex.current;
      if (idx >= DEMO_LINES.length) {
        window.clearInterval(demoTimer.current!);
        setDemoing(false);
        return;
      }
      setCaptions((prev) => [...prev, DEMO_LINES[idx]]);
      demoIndex.current = idx + 1;
    }, 1500);
  }

  function stopDemo() {
    if (demoTimer.current) window.clearInterval(demoTimer.current);
    setDemoing(false);
  }

  const transcript = captions.join(" ");

  return (
    <>
      {/* ── Header ── */}
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
            className="btn-summarize"
            onClick={demoing ? stopDemo : startDemo}
            disabled={isRecording}
          >
            {demoing ? "Stop Demo" : "Demo"}
          </button>
          <button
            className={`btn-record ${isRecording ? "active" : ""}`}
            onClick={isRecording ? stop : start}
            disabled={demoing}
          >
            {isRecording ? "Stop" : "Start Listening"}
          </button>
        </div>
      </header>

      {/* ── Dashboard ── */}
      <main className="dashboard">
        <section className="panel panel-left">
          <div className="panel-header">Live Transcript</div>
          <div className="panel-body">
            <CaptionView captions={captions} />
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">Conversation Intel</div>
          <div className="panel-body">
            <SummaryPanel transcript={transcript} />
          </div>
        </section>
      </main>
    </>
  );
}

export default App;
