import { useEffect, useRef } from "react";

interface CaptionViewProps {
  captions: string[];
}

export function CaptionView({ captions }: CaptionViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [captions]);

  if (captions.length === 0) {
    return (
      <div style={{ color: "#52525b", textAlign: "center", marginTop: "3rem" }}>
        <p style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Waiting for conversation...</p>
        <p style={{ fontSize: "0.85rem" }}>Press Start Listening to begin</p>
      </div>
    );
  }

  return (
    <div>
      {captions.map((text, i) => (
        <div
          key={i}
          style={{
            padding: "0.5rem 0.75rem",
            marginBottom: "0.25rem",
            borderLeft: "3px solid #3f3f46",
            borderRadius: "2px",
            fontSize: "0.9rem",
            lineHeight: "1.6",
            color: "#d4d4d8",
          }}
        >
          {text}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
