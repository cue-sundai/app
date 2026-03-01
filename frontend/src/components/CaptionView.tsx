import type { TranscriptSegment } from "../hooks/useAudioCapture";

interface CaptionViewProps {
  segments: TranscriptSegment[];
  names: Record<number, string>;
}

export function CaptionView({ segments, names }: CaptionViewProps) {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "1rem" }}>
      <h2>Live Captions</h2>
      {segments.length === 0 ? (
        <p style={{ color: "#888" }}>
          Press Start to begin capturing audio and video...
        </p>
      ) : (
        segments.map((seg, i) => (
          <p key={i} style={{ margin: "0.25rem 0" }}>
            <strong>{names[seg.speaker] || (seg.speaker === 0 ? "You" : `Speaker ${seg.speaker}`)}:</strong> {seg.text}
          </p>
        ))
      )}
    </div>
  );
}
