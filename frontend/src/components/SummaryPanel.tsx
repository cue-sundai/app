import { useState, useEffect, useRef } from "react";

interface SummaryPanelProps {
  transcript: string;
  isRecording: boolean;
}

export function SummaryPanel({ transcript, isRecording }: SummaryPanelProps) {
  const [summary, setSummary] = useState<{
    summary: string;
    people: string[];
    topics: string[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const wasRecordingRef = useRef(false);

  async function runSummarize() {
    if (!transcript.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();
      setSummary(data);
    } finally {
      setLoading(false);
    }
  }

  // When recording stops, auto-run summarization
  useEffect(() => {
    if (wasRecordingRef.current && !isRecording && transcript.trim()) {
      runSummarize();
    }
    wasRecordingRef.current = isRecording;
  }, [isRecording, transcript]);

  return (
    <div style={{ padding: "1rem", borderTop: "1px solid #333" }}>
      <button onClick={runSummarize} disabled={!transcript || loading}>
        {loading ? "Summarizing..." : "Summarize Conversation"}
      </button>

      {summary && (
        <div style={{ marginTop: "1rem" }}>
          <h3>Summary</h3>
          <p>{summary.summary}</p>

          <h4>People</h4>
          <ul>
            {summary.people.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>

          <h4>Topics</h4>
          <ul>
            {summary.topics.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
