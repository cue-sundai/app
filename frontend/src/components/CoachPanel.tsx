import { useState, useEffect, useRef } from "react";

interface PersonEntity {
  name: string;
  detail?: string | null;
}

interface CoachInsights {
  people: PersonEntity[];
  topics: string[];
  suggested_questions: string[];
  nudge: string | null;
}

interface CoachPanelProps {
  transcript: string;
  captionCount: number;
  isActive: boolean;
  startTime: number | null;
  onSummarize: () => void;
}

export function CoachPanel({
  transcript,
  captionCount,
  startTime,
  onSummarize,
}: CoachPanelProps) {
  const [insights, setInsights] = useState<CoachInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const lastAnalyzedCount = useRef(0);
  const debounceTimer = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Fire a coach analysis when enough new lines have arrived.
  // We use a ref-based approach so the cleanup doesn't cancel the timer
  // on every captionCount change (which happens every 1.5s in demo).
  const transcriptRef = useRef(transcript);
  transcriptRef.current = transcript;
  const startTimeRef = useRef(startTime);
  startTimeRef.current = startTime;

  useEffect(() => {
    if (captionCount === 0) return;
    if (captionCount - lastAnalyzedCount.current < 3) return;

    // Enough new lines — schedule analysis
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    lastAnalyzedCount.current = captionCount;

    debounceTimer.current = window.setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      setLoading(true);
      try {
        const elapsed = startTimeRef.current
          ? Math.floor((Date.now() - startTimeRef.current) / 1000)
          : 0;
        const res = await fetch(`http://${window.location.hostname}:8820/api/coach`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: transcriptRef.current,
            elapsed_seconds: elapsed,
          }),
          signal: abortRef.current.signal,
        });
        const data = await res.json();
        setInsights(data);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
      setLoading(false);
    }, 2000);
  }, [captionCount]);

  // Empty state
  if (!insights && !loading) {
    return (
      <div style={{ textAlign: "center", marginTop: "3rem" }}>
        <p style={{ color: "#52525b", fontSize: "0.9rem" }}>
          Start a conversation to see live coaching insights
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Nudge banner */}
      {insights?.nudge && (
        <div
          style={{
            backgroundColor: "#1a1a2e",
            border: "1px solid #312e81",
            borderRadius: "8px",
            padding: "0.75rem 1rem",
            fontSize: "0.85rem",
            color: "#a5b4fc",
            lineHeight: 1.5,
          }}
        >
          {insights.nudge}
        </div>
      )}

      {/* Loading indicator */}
      {loading && !insights && (
        <div style={{ textAlign: "center", color: "#71717a", fontSize: "0.85rem" }}>
          Analyzing conversation...
        </div>
      )}

      {/* People cards */}
      {insights && insights.people.length > 0 && (
        <div>
          <h3
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "#71717a",
              marginBottom: "0.5rem",
            }}
          >
            People
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {insights.people.map((person, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  backgroundColor: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: "8px",
                  padding: "0.6rem 0.85rem",
                }}
              >
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(person.name)}&background=312e81&color=a5b4fc&size=32&bold=true&font-size=0.4`}
                  alt={person.name}
                  style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0 }}
                />
                <div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#d4d4d8" }}>
                    {person.name}
                  </div>
                  {person.detail && (
                    <div style={{ fontSize: "0.7rem", color: "#a1a1aa" }}>
                      {person.detail}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Topic chips */}
      {insights && insights.topics.length > 0 && (
        <div>
          <h3
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "#71717a",
              marginBottom: "0.5rem",
            }}
          >
            Topics
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {insights.topics.map((topic, i) => (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  padding: "0.25em 0.75em",
                  borderRadius: "999px",
                  fontSize: "0.8rem",
                  fontWeight: 500,
                  backgroundColor: "#1c1c1f",
                  color: "#a1a1aa",
                  border: "1px solid #3f3f46",
                }}
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Suggested questions */}
      {insights && insights.suggested_questions.length > 0 && (
        <div>
          <h3
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "#71717a",
              marginBottom: "0.5rem",
            }}
          >
            Suggested Questions
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {insights.suggested_questions.map((q, i) => (
              <div
                key={i}
                style={{
                  padding: "0.5rem 0.75rem",
                  borderLeft: "3px solid #312e81",
                  backgroundColor: "#18181b",
                  borderRadius: "0 6px 6px 0",
                  fontSize: "0.82rem",
                  color: "#d4d4d8",
                  lineHeight: 1.5,
                }}
              >
                {q}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summarize button */}
      <button
        onClick={onSummarize}
        disabled={!transcript}
        style={{
          alignSelf: "center",
          backgroundColor: "#1e1b4b",
          borderColor: "#312e81",
          color: "#a5b4fc",
          padding: "0.6em 1.5em",
          marginTop: "0.5rem",
        }}
      >
        Summarize Conversation
      </button>
    </div>
  );
}
