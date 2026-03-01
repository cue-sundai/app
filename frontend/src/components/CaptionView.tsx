import { useEffect, useRef } from "react";

interface CaptionViewProps {
  captions: string[];
}

export function CaptionView({ captions }: CaptionViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [captions]);

  return (
    <div className="panel">
      <div className="panel-header">Live Transcript</div>
      <div className="panel-body">
        {captions.length === 0 ? (
          <p className="caption-placeholder">
            Press Start to begin capturing audio...
          </p>
        ) : (
          captions.map((text, i) => (
            <p key={i} className="caption-line">
              {text}
            </p>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
