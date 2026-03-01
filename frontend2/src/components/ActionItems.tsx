import { useState, useMemo } from "react";
import { ParticipantCard } from "./ParticipantCard";

export interface ActionItem {
  text: string;
  assignee?: string;
}

export interface CalendarEvent {
  title: string;
  date?: string;
  time?: string;
  attendee?: string;
}

interface ActionItemsProps {
  items: ActionItem[];
  calendarEvents: CalendarEvent[];
  people: string[];
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

function itemsToMarkdown(items: ActionItem[], events: CalendarEvent[]): string {
  const todoLines = items
    .map((item) => {
      const assignee = item.assignee ? ` (@${item.assignee})` : "";
      return `- [ ] ${item.text}${assignee}`;
    })
    .join("\n");

  const eventLines = events
    .map((e) => {
      const when = [e.date, e.time].filter(Boolean).join(" at ");
      const attendee = e.attendee ? ` (with ${e.attendee})` : "";
      return `- ${e.title}${attendee}${when ? ` — ${when}` : ""}`;
    })
    .join("\n");

  let md = "";
  if (todoLines) md += todoLines;
  if (eventLines) md += `\n\n## Scheduled\n${eventLines}`;
  return md;
}

export function ActionItems({ items, calendarEvents, people }: ActionItemsProps) {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [copyLabel, setCopyLabel] = useState("Copy");
  const [sendingReminders, setSendingReminders] = useState(false);
  const [sendingCalendar, setSendingCalendar] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Group items by assignee AND calendar events by attendee
  const grouped = useMemo(() => {
    // Group action items
    const itemMap = new Map<string, { item: ActionItem; globalIndex: number }[]>();
    items.forEach((item, i) => {
      const key = item.assignee || "__general__";
      if (!itemMap.has(key)) itemMap.set(key, []);
      itemMap.get(key)!.push({ item, globalIndex: i });
    });

    // Group calendar events
    const eventMap = new Map<string, CalendarEvent[]>();
    calendarEvents.forEach((event) => {
      const key = event.attendee || "__general__";
      if (!eventMap.has(key)) eventMap.set(key, []);
      eventMap.get(key)!.push(event);
    });

    // Collect all unique person keys
    const allKeys = new Set<string>([...itemMap.keys(), ...eventMap.keys()]);

    const ordered: {
      name: string;
      isGeneral: boolean;
      itemEntries: { item: ActionItem; globalIndex: number }[];
      events: CalendarEvent[];
    }[] = [];

    // People from the people[] array first
    for (const person of people) {
      if (allKeys.has(person)) {
        ordered.push({
          name: person,
          isGeneral: false,
          itemEntries: itemMap.get(person) || [],
          events: eventMap.get(person) || [],
        });
        allKeys.delete(person);
      }
    }
    // Remaining assignees not in people[]
    for (const key of allKeys) {
      if (key !== "__general__") {
        ordered.push({
          name: key,
          isGeneral: false,
          itemEntries: itemMap.get(key) || [],
          events: eventMap.get(key) || [],
        });
      }
    }
    // General bucket last
    if (allKeys.has("__general__")) {
      ordered.push({
        name: "General",
        isGeneral: true,
        itemEntries: itemMap.get("__general__") || [],
        events: eventMap.get("__general__") || [],
      });
    }

    return ordered;
  }, [items, calendarEvents, people]);

  function toggle(index: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function handleCopy() {
    const md = itemsToMarkdown(items, calendarEvents);
    await navigator.clipboard.writeText(md);
    setCopyLabel("Copied!");
    setTimeout(() => setCopyLabel("Copy"), 2000);
  }

  function handleExport() {
    const md = `# Action Items\n\n${itemsToMarkdown(items, calendarEvents)}\n`;
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
    setSendingCalendar(true);
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
      setStatusMsg("Failed to add to Calendar");
    }
    setSendingCalendar(false);
    setTimeout(() => setStatusMsg(null), 3000);
  }

  if (items.length === 0 && calendarEvents.length === 0) return null;

  return (
    <div>
      {/* Global toolbar */}
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
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button style={btnStyle} onClick={handleCopy}>
            {copyLabel}
          </button>
          <button style={btnStyle} onClick={handleExport}>
            .md
          </button>
          {items.length > 0 && (
            <button
              style={{ ...btnStyle, borderColor: "#312e81", color: "#a5b4fc" }}
              onClick={handleReminders}
              disabled={sendingReminders}
            >
              {sendingReminders ? "..." : "Reminders"}
            </button>
          )}
          {calendarEvents.length > 0 && (
            <button
              style={{ ...btnStyle, borderColor: "#1e3b2e", color: "#86efac" }}
              onClick={handleCalendarAll}
              disabled={sendingCalendar}
            >
              {sendingCalendar ? "..." : "Calendar All"}
            </button>
          )}
        </div>
      </div>

      {statusMsg && (
        <div
          style={{
            fontSize: "0.75rem",
            color: "#22c55e",
            marginBottom: "0.5rem",
          }}
        >
          {statusMsg}
        </div>
      )}

      {/* Participant cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {grouped.map((group) => (
          <ParticipantCard
            key={group.name}
            name={group.name}
            isGeneral={group.isGeneral}
            items={group.itemEntries.map((e) => e.item)}
            events={group.events}
            checkedIndices={checked}
            onToggle={toggle}
            globalIndices={group.itemEntries.map((e) => e.globalIndex)}
          />
        ))}
      </div>
    </div>
  );
}
