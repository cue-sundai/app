import { useState, useEffect, useRef } from "react";
import { ActionItems, type ActionItem, type CalendarEvent } from "./ActionItems";

interface SummaryPanelProps {
  transcript: string;
  isRecording: boolean;
}

export function SummaryPanel({ transcript, isRecording }: SummaryPanelProps) {
  const [summary, setSummary] = useState<{
    summary: string;
    people: string[];
    topics: string[];
    action_items?: ActionItem[];
    calendar_events?: CalendarEvent[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const wasRecordingRef = useRef(false);

  async function runSummarize() {
    if (!transcript.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`http://${window.location.hostname}:8820/api/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSummary({
        summary: data.summary || "No summary available.",
        people: Array.isArray(data.people) ? data.people : [],
        topics: Array.isArray(data.topics) ? data.topics : [],
        action_items: Array.isArray(data.action_items) ? data.action_items : [],
        calendar_events: Array.isArray(data.calendar_events) ? data.calendar_events : [],
      });
    } catch (e) {
      console.error("Summarize error", e);
      setSummary({ summary: "Failed to summarize. Please try again.", people: [], topics: [] });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (wasRecordingRef.current && !isRecording && transcript.trim()) {
      runSummarize();
    }
    wasRecordingRef.current = isRecording;
  }, [isRecording, transcript]);

  if (!summary && !loading) {
    return (
      <div style={{ textAlign: "center", marginTop: "3rem" }}>
        <p style={{ color: "#52525b", fontSize: "0.9rem", marginBottom: "1rem" }}>
          Analyze the conversation to extract insights (auto-runs when you stop
          listening)
        </p>
        <button
          onClick={runSummarize}
          disabled={!transcript}
          className="btn-summarize"
          style={{
            padding: "0.6em 1.5em",
          }}
        >
          Summarize
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", marginTop: "3rem", color: "#71717a" }}>
        Analyzing conversation...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div
        style={{
          backgroundColor: "#18181b",
          border: "1px solid #27272a",
          borderRadius: "8px",
          padding: "1rem",
        }}
      >
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
          Summary
        </h3>
        <p style={{ fontSize: "0.9rem", lineHeight: 1.7, color: "#d4d4d8" }}>
          {summary!.summary}
        </p>
      </div>

      {summary!.people.length > 0 && (
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
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {summary!.people.map((person, i) => (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  padding: "0.25em 0.75em",
                  borderRadius: "999px",
                  fontSize: "0.8rem",
                  fontWeight: 500,
                  backgroundColor: "#1e1b4b",
                  color: "#a5b4fc",
                  border: "1px solid #312e81",
                }}
              >
                {person}
              </span>
            ))}
          </div>
        </div>
      )}

      {summary!.topics.length > 0 && (
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
            {summary!.topics.map((topic, i) => (
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

      {(summary!.action_items?.length || summary!.calendar_events?.length) ? (
        <ActionItems
          items={summary!.action_items || []}
          calendarEvents={summary!.calendar_events || []}
        />
      ) : null}

      <button
        onClick={runSummarize}
        disabled={!transcript}
        style={{ alignSelf: "flex-start", fontSize: "0.8rem" }}
      >
        Re-summarize
      </button>
    </div>
  );
}
