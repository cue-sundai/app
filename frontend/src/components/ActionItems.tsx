import { useState } from "react";
import { ParticipantCard } from "./ParticipantCard";

export interface ActionItem {
  text: string;
  assignee?: string | null;
}

export interface CalendarEvent {
  title: string;
  date?: string | null;
  time?: string | null;
  attendee?: string | null;
}

interface ActionItemsProps {
  items: ActionItem[];
  calendarEvents?: CalendarEvent[];
}

const btnStyle: React.CSSProperties = {
  fontSize: "0.7rem",
  padding: "0.3em 0.6em",
  borderRadius: "4px",
  border: "1px solid #3f3f46",
  backgroundColor: "#1c1c1f",
  color: "#a1a1aa",
  cursor: "pointer",
};

function itemsToMarkdown(items: ActionItem[]): string {
  return items
    .map((item) => {
      const assignee = item.assignee ? ` (@${item.assignee})` : "";
      return `- [ ] ${item.text}${assignee}`;
    })
    .join("\n");
}

export function ActionItems({ items, calendarEvents = [] }: ActionItemsProps) {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [copyLabel, setCopyLabel] = useState("Copy");
  const [sendingReminders, setSendingReminders] = useState(false);
  const [sendingCalendarAll, setSendingCalendarAll] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  function toggle(index: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function handleCopy() {
    const md = itemsToMarkdown(items);
    await navigator.clipboard.writeText(md);
    setCopyLabel("Copied!");
    setTimeout(() => setCopyLabel("Copy"), 2000);
  }

  function handleExport() {
    const md = `# Action Items\n\n${itemsToMarkdown(items)}\n`;
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "action-items.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleReminders() {
    setSendingReminders(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      setStatusMsg(data.message || "Added to Reminders!");
    } catch {
      setStatusMsg("Failed to add reminders");
    }
    setSendingReminders(false);
    setTimeout(() => setStatusMsg(null), 3000);
  }

  async function handleCalendarAll() {
    setSendingCalendarAll(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: calendarEvents }),
      });
      const data = await res.json();
      setStatusMsg(data.message || "Added to Calendar!");
    } catch {
      setStatusMsg("Failed to add events");
    }
    setSendingCalendarAll(false);
    setTimeout(() => setStatusMsg(null), 3000);
  }

  if (items.length === 0 && calendarEvents.length === 0) return null;

  // Group items + events by assignee/attendee
  const grouped = new Map<string, { items: ActionItem[]; events: CalendarEvent[]; indices: number[] }>();

  items.forEach((item, i) => {
    const key = item.assignee || "General";
    if (!grouped.has(key)) grouped.set(key, { items: [], events: [], indices: [] });
    const g = grouped.get(key)!;
    g.items.push(item);
    g.indices.push(i);
  });

  calendarEvents.forEach((event) => {
    const key = event.attendee || "General";
    if (!grouped.has(key)) grouped.set(key, { items: [], events: [], indices: [] });
    grouped.get(key)!.events.push(event);
  });

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.5rem",
        }}
      >
        <h3
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "#71717a",
          }}
        >
          Action Items
        </h3>
        <div style={{ display: "flex", gap: "0.35rem" }}>
          <button style={btnStyle} onClick={handleCopy}>{copyLabel}</button>
          <button style={btnStyle} onClick={handleExport}>.md</button>
          <button
            style={{ ...btnStyle, borderColor: "#312e81", color: "#a5b4fc" }}
            onClick={handleReminders}
            disabled={sendingReminders}
          >
            {sendingReminders ? "..." : "Reminders"}
          </button>
          {calendarEvents.length > 0 && (
            <button
              style={{ ...btnStyle, borderColor: "#1e3b2e", color: "#86efac" }}
              onClick={handleCalendarAll}
              disabled={sendingCalendarAll}
            >
              {sendingCalendarAll ? "..." : "Calendar All"}
            </button>
          )}
        </div>
      </div>

      {statusMsg && (
        <div style={{ fontSize: "0.75rem", color: "#22c55e", marginBottom: "0.5rem" }}>
          {statusMsg}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {Array.from(grouped.entries()).map(([name, group]) => (
          <ParticipantCard
            key={name}
            name={name}
            isGeneral={name === "General"}
            items={group.items}
            events={group.events}
            checkedIndices={checked}
            onToggle={toggle}
            globalIndices={group.indices}
          />
        ))}
      </div>
    </div>
  );
}
