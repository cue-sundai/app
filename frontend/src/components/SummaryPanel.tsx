import { useState } from "react";

interface SummaryPanelProps {
  transcript: string;
}

export function SummaryPanel({ transcript }: SummaryPanelProps) {
  const [summary, setSummary] = useState<{
    summary: string;
    people: string[];
    topics: string[];
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

  return (
    <div className="panel">
      <div className="panel-header">Summary</div>
      <div className="panel-body">
        <button
          className="btn btn-secondary"
          onClick={handleSummarize}
          disabled={!transcript || loading}
        >
          {loading ? "Summarizing..." : "Summarize Conversation"}
        </button>

        {summary && (
          <div className="summary-section">
            <h3>Overview</h3>
            <p>{summary.summary}</p>

            <h3>People</h3>
            <ul>
              {summary.people.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>

            <h3>Topics</h3>
            <ul>
              {summary.topics.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
