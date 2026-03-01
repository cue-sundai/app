import { useRef, useState, useCallback } from "react";

/**
 * Hook for capturing microphone audio and streaming it via WebSocket.
 *
 * Usage:
 *   const { isRecording, start, stop } = useAudioCapture(onTranscript);
 */
export function useAudioCapture(
  onTranscript: (text: string, isFinal: boolean) => void,
) {
  const [isRecording, setIsRecording] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ws = new WebSocket(`ws://${window.location.host}/ws/transcribe`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onTranscript(data.text, data.is_final);
    };

    ws.onopen = () => {
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          ws.send(e.data);
        }
      };

      // Send a chunk every 2 seconds
      recorder.start(2000);
      setIsRecording(true);
    };
  }, [onTranscript]);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    setIsRecording(false);
  }, []);

  return { isRecording, start, stop };
}
