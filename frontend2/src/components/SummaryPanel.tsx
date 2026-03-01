import { useState } from "react";
import { ActionItems, type ActionItem, type CalendarEvent } from "./ActionItems";

interface SummaryPanelProps {
  transcript: string;
}

export function SummaryPanel({ transcript }: SummaryPanelProps) {
  const [summary, setSummary] = useState<{
    summary: string;
    people: string[];
    topics: string[];
    action_items: ActionItem[];
    calendar_events: CalendarEvent[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSummarize() {
    setLoading(true);
    const res = await fetch("/api/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript }),
    });
    const data = await res.json();
    setSummary(data);
    setLoading(false);
  }

  if (!summary && !loading) {
    return (
      <div style={{ textAlign: "center", marginTop: "3rem" }}>
        <p style={{ color: "#52525b", fontSize: "0.9rem", marginBottom: "1rem" }}>
          Analyze the conversation to extract insights
        </p>
        <button
          onClick={handleSummarize}
          disabled={!transcript}
          style={{
            backgroundColor: "#1e1b4b",
            borderColor: "#312e81",
            color: "#a5b4fc",
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
      {/* Summary card */}
      <div
        style={{
          backgroundColor: "#18181b",
          border: "1px solid #27272a",
          borderRadius: "8px",
          padding: "1rem",
        }}
      >
        <h3 style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#71717a", marginBottom: "0.5rem" }}>
          Summary
        </h3>
        <p style={{ fontSize: "0.9rem", lineHeight: 1.7, color: "#d4d4d8" }}>
          {summary!.summary}
        </p>
      </div>

      {/* People chips */}
      {summary!.people.length > 0 && (
        <div>
          <h3 style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#71717a", marginBottom: "0.5rem" }}>
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

      {/* Topic chips */}
      {summary!.topics.length > 0 && (
        <div>
          <h3 style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#71717a", marginBottom: "0.5rem" }}>
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

      {/* Action items + calendar events */}
      {(summary!.action_items?.length > 0 || summary!.calendar_events?.length > 0) && (
        <ActionItems
          items={summary!.action_items || []}
          calendarEvents={summary!.calendar_events || []}
          people={summary!.people}
        />
      )}

      {/* Re-summarize button */}
      <button
        onClick={handleSummarize}
        disabled={!transcript}
        style={{ alignSelf: "flex-start", fontSize: "0.8rem" }}
      >
        Re-summarize
      </button>
    </div>
  );
}
