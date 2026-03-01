import { useRef, useState, useCallback } from "react";

/**
 * Hook for capturing microphone audio and streaming it via WebSocket.
 *
 * Usage:
 *   const { isRecording, error, start, stop } = useAudioCapture(onTranscript);
 */
export function useAudioCapture(
  onTranscript: (text: string, isFinal: boolean) => void,
) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const start = useCallback(async () => {
    setError(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access denied. Please allow mic permissions.");
      return;
    }

    const ws = new WebSocket(`ws://${window.location.host}/ws/transcribe`);
    wsRef.current = ws;

    ws.onerror = () => {
      setError("Could not connect to transcription service.");
      stream.getTracks().forEach((t) => t.stop());
    };

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

  return { isRecording, error, start, stop };
}
