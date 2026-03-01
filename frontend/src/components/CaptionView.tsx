import { useEffect, useRef } from "react";
import type { TranscriptSegment } from "../hooks/useAudioCapture";

interface CaptionViewProps {
  segments: TranscriptSegment[];
  names?: Record<number, string>;
}

function speakerLabel(speaker: number, names?: Record<number, string>): string {
  if (names && names[speaker]) return names[speaker];
  return speaker === 0 ? "You" : `Speaker ${speaker}`;
}

export function CaptionView({ segments, names }: CaptionViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [segments]);

  if (segments.length === 0) {
    return (
      <div style={{ color: "#52525b", textAlign: "center", marginTop: "3rem" }}>
        <p style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
          Waiting for conversation...
        </p>
        <p style={{ fontSize: "0.85rem" }}>
          Press Start Listening to begin (camera + mic)
        </p>
      </div>
    );
  }

  return (
    <div>
      {segments.map((seg, i) => (
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
          <strong>{speakerLabel(seg.speaker, names)}:</strong> {seg.text}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
