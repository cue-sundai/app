import { useState } from "react";
import type { ActionItem, CalendarEvent } from "./ActionItems";

interface ParticipantCardProps {
  name: string;
  isGeneral?: boolean;
  items: ActionItem[];
  events: CalendarEvent[];
  checkedIndices: Set<number>;
  onToggle: (globalIndex: number) => void;
  globalIndices: number[];
}

const smallBtnStyle: React.CSSProperties = {
  fontSize: "0.7rem",
  padding: "0.3em 0.6em",
  borderRadius: "4px",
  border: "1px solid #3f3f46",
  backgroundColor: "#1c1c1f",
  cursor: "pointer",
};

export function ParticipantCard({
  name,
  isGeneral,
  items,
  events,
  checkedIndices,
  onToggle,
  globalIndices,
}: ParticipantCardProps) {
  const [role, setRole] = useState("");
  const [editingRole, setEditingRole] = useState(false);
  const [sendingNotion, setSendingNotion] = useState(false);
  const [notionMsg, setNotionMsg] = useState<string | null>(null);
  const [sendingCalendar, setSendingCalendar] = useState(false);
  const [calendarMsg, setCalendarMsg] = useState<string | null>(null);

  const avatarUrl = isGeneral
    ? null
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=312e81&color=a5b4fc&size=36&bold=true&font-size=0.4`;

  async function handleNotion() {
    setSendingNotion(true);
    setNotionMsg(null);
    try {
      const res = await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      setNotionMsg(data.message || "Pushed to Notion!");
    } catch {
      setNotionMsg("Failed to push to Notion");
    }
    setSendingNotion(false);
    setTimeout(() => setNotionMsg(null), 3000);
  }

  async function handleCalendar() {
    setSendingCalendar(true);
    setCalendarMsg(null);
    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events }),
      });
      const data = await res.json();
      setCalendarMsg(data.message || "Added to Calendar!");
    } catch {
      setCalendarMsg("Failed to add to Calendar");
    }
    setSendingCalendar(false);
    setTimeout(() => setCalendarMsg(null), 3000);
  }

  return (
    <div
      style={{
        backgroundColor: "#18181b",
        border: "1px solid #27272a",
        borderRadius: "8px",
        padding: "0.75rem 1rem",
      }}
    >
      {/* Header: avatar + name + role + action buttons */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          marginBottom: "0.6rem",
        }}
      >
        {/* Avatar */}
        {isGeneral ? (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              backgroundColor: "#27272a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.9rem",
              flexShrink: 0,
            }}
          >
            +
          </div>
        ) : (
          <img
            src={avatarUrl!}
            alt={name}
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              flexShrink: 0,
            }}
          />
        )}

        {/* Name + Role */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#d4d4d8" }}>
            {name}
          </div>
          {!isGeneral && (
            editingRole ? (
              <input
                autoFocus
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                onBlur={() => setEditingRole(false)}
                onKeyDown={(e) => { if (e.key === "Enter") setEditingRole(false); }}
                placeholder="e.g. Product @ Stripe"
                style={{
                  fontSize: "0.7rem",
                  color: "#a1a1aa",
                  backgroundColor: "transparent",
                  border: "1px solid #3f3f46",
                  borderRadius: "3px",
                  padding: "0.1em 0.3em",
                  outline: "none",
                  width: "100%",
                  fontFamily: "inherit",
                }}
              />
            ) : (
              <div
                onClick={() => setEditingRole(true)}
                style={{
                  fontSize: "0.7rem",
                  color: role ? "#a1a1aa" : "#52525b",
                  cursor: "pointer",
                }}
              >
                {role || "Add role..."}
              </div>
            )
          )}
        </div>

        {/* Action buttons */}
        {!isGeneral && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem" }}>
            <div style={{ display: "flex", gap: "0.3rem" }}>
              {items.length > 0 && (
                <button
                  style={{ ...smallBtnStyle, borderColor: "#1e3a5f", color: "#93c5fd" }}
                  onClick={handleNotion}
                  disabled={sendingNotion}
                >
                  {sendingNotion ? "..." : "Notion"}
                </button>
              )}
              {events.length > 0 && (
                <button
                  style={{ ...smallBtnStyle, borderColor: "#1e3b2e", color: "#86efac" }}
                  onClick={handleCalendar}
                  disabled={sendingCalendar}
                >
                  {sendingCalendar ? "..." : "Calendar"}
                </button>
              )}
            </div>
            {notionMsg && (
              <span style={{ fontSize: "0.65rem", color: "#22c55e" }}>{notionMsg}</span>
            )}
            {calendarMsg && (
              <span style={{ fontSize: "0.65rem", color: "#22c55e" }}>{calendarMsg}</span>
            )}
          </div>
        )}
      </div>

      {/* To-do items */}
      {items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          {items.map((item, i) => {
            const globalIdx = globalIndices[i];
            const done = checkedIndices.has(globalIdx);
            return (
              <label
                key={globalIdx}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.6rem",
                  padding: "0.4rem 0.6rem",
                  borderRadius: "5px",
                  backgroundColor: done ? "#111113" : "#1c1c1f",
                  border: `1px solid ${done ? "#27272a" : "#3f3f46"}`,
                  cursor: "pointer",
                  transition: "background-color 0.15s",
                }}
              >
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => onToggle(globalIdx)}
                  style={{ marginTop: "0.15rem", accentColor: "#22c55e" }}
                />
                <span
                  style={{
                    fontSize: "0.82rem",
                    lineHeight: 1.5,
                    color: done ? "#52525b" : "#d4d4d8",
                    textDecoration: done ? "line-through" : "none",
                    flex: 1,
                  }}
                >
                  {item.text}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {/* Calendar events */}
      {events.length > 0 && (
        <div style={{ marginTop: items.length > 0 ? "0.5rem" : 0, display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          {events.map((event, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                padding: "0.4rem 0.6rem",
                borderRadius: "5px",
                backgroundColor: "#111a15",
                border: "1px solid #1e3b2e",
              }}
            >
              <span style={{ fontSize: "0.85rem", flexShrink: 0 }}>
                &#128197;
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "0.82rem", color: "#d4d4d8", lineHeight: 1.4 }}>
                  {event.title}
                </div>
                {(event.date || event.time) && (
                  <div style={{ fontSize: "0.7rem", color: "#86efac" }}>
                    {[event.date, event.time].filter(Boolean).join(" at ")}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
