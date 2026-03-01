interface CaptionViewProps {
  captions: string[];
}

export function CaptionView({ captions }: CaptionViewProps) {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "1rem" }}>
      <h2>Live Captions</h2>
      {captions.length === 0 ? (
        <p style={{ color: "#888" }}>
          Press Start to begin capturing audio...
        </p>
      ) : (
        captions.map((text, i) => (
          <p key={i} style={{ margin: "0.25rem 0" }}>
            {text}
          </p>
        ))
      )}
    </div>
  );
}
