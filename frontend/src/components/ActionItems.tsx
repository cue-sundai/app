import { useState } from "react";

export interface ActionItem {
    text: string;
    assignee?: string;
}

interface ActionItemsProps {
    items: ActionItem[];
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

export function ActionItems({ items }: ActionItemsProps) {
    const [checked, setChecked] = useState<Set<number>>(new Set());
    const [copyLabel, setCopyLabel] = useState("Copy");
    const [sendingReminders, setSendingReminders] = useState(false);
    const [sendingNotion, setSendingNotion] = useState(false);
    const [statusMsg, setStatusMsg] = useState<string | null>(null);

    function toggle(index: number) {
        setChecked((prev) => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
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

    async function handleNotion() {
        setSendingNotion(true);
        setStatusMsg(null);
        try {
            const res = await fetch("/api/notion", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items }),
            });
            const data = await res.json();
            setStatusMsg(data.message || "Pushed to Notion!");
        } catch {
            setStatusMsg("Failed to push to Notion");
        }
        setSendingNotion(false);
        setTimeout(() => setStatusMsg(null), 3000);
    }

    if (items.length === 0) return null;

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
                    <button style={btnStyle} onClick={handleCopy}>
                        {copyLabel}
                    </button>
                    <button style={btnStyle} onClick={handleExport}>
                        .md
                    </button>
                    <button
                        style={{ ...btnStyle, borderColor: "#312e81", color: "#a5b4fc" }}
                        onClick={handleReminders}
                        disabled={sendingReminders}
                    >
                        {sendingReminders ? "..." : "Reminders"}
                    </button>
                    <button
                        style={{ ...btnStyle, borderColor: "#1e3a5f", color: "#93c5fd" }}
                        onClick={handleNotion}
                        disabled={sendingNotion}
                    >
                        {sendingNotion ? "..." : "Notion"}
                    </button>
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

            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                {items.map((item, i) => {
                    const done = checked.has(i);
                    return (
                        <label
                            key={i}
                            style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: "0.6rem",
                                padding: "0.5rem 0.75rem",
                                borderRadius: "6px",
                                backgroundColor: done ? "#18181b" : "#1c1c1f",
                                border: `1px solid ${done ? "#27272a" : "#3f3f46"}`,
                                cursor: "pointer",
                                transition: "background-color 0.15s",
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={done}
                                onChange={() => toggle(i)}
                                style={{ marginTop: "0.2rem", accentColor: "#22c55e" }}
                            />
                            <span
                                style={{
                                    fontSize: "0.85rem",
                                    lineHeight: 1.5,
                                    color: done ? "#52525b" : "#d4d4d8",
                                    textDecoration: done ? "line-through" : "none",
                                    flex: 1,
                                }}
                            >
                                {item.text}
                            </span>
                            {item.assignee && (
                                <span
                                    style={{
                                        fontSize: "0.7rem",
                                        padding: "0.15em 0.5em",
                                        borderRadius: "999px",
                                        backgroundColor: "#1e1b4b",
                                        color: "#a5b4fc",
                                        border: "1px solid #312e81",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {item.assignee}
                                </span>
                            )}
                        </label>
                    );
                })}
            </div>
        </div>
    );
}
