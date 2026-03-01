import { useRef, useState, useCallback } from "react";

export interface TranscriptSegment {
  speaker: number;
  text: string;
}

const AUDIO_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function getSupportedAudioMimeType(): string {
  for (const mime of AUDIO_MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "";
}

/**
 * Hook for capturing microphone audio and webcam video, streaming audio via WebSocket.
 * Returns the video stream so the UI can show the webcam.
 * When the backend sends replace: true, onTranscript is called with (segments, true) to replace instead of append.
 * When is_partial: true, the segments are the current in-progress line (UI should replace last line, not append).
 */
export function useAudioCapture(
  onTranscript: (
    segments: TranscriptSegment[],
    replace?: boolean,
    isPartial?: boolean,
  ) => void,
) {
  const [isRecording, setIsRecording] = useState(false);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const restartIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: { width: 640, height: 480 },
    });
    streamRef.current = stream;
    setVideoStream(stream);

    const mimeType = getSupportedAudioMimeType();
    if (!mimeType) {
      stream.getTracks().forEach((t) => t.stop());
      setVideoStream(null);
      throw new Error(
        "No supported audio recording format (webm/mp4/ogg) in this browser.",
      );
    }

    const ws = new WebSocket(`ws://${window.location.host}/ws/transcribe`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const segments = Array.isArray(data.segments)
        ? data.segments
        : data.text != null
          ? [{ speaker: 0, text: data.text }]
          : [];
      if (segments.length > 0) {
        onTranscript(
          segments,
          data.replace === true,
          data.is_partial === true,
        );
      }
    };

    const startRecorder = () => {
      const s = streamRef.current;
      const socket = wsRef.current;
      if (!s || !socket || socket.readyState !== WebSocket.OPEN) return;
      const audioOnly = new MediaStream(s.getAudioTracks());
      const recorder = new MediaRecorder(audioOnly, { mimeType });
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(e.data);
        }
      };
      recorder.start(2000);
    };

    ws.onopen = () => {
      ws.send(JSON.stringify({ mimeType }));
      startRecorder();
      setIsRecording(true);
      restartIntervalRef.current = setInterval(() => {
        if (recorderRef.current) recorderRef.current.stop();
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ newSession: true }));
        }
        startRecorder();
      }, 20000);
    };
  }, [onTranscript]);

  const stop = useCallback(() => {
    if (restartIntervalRef.current) {
      clearInterval(restartIntervalRef.current);
      restartIntervalRef.current = null;
    }
    recorderRef.current?.stop();
    recorderRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setVideoStream(null);
    setIsRecording(false);
  }, []);

  return { isRecording, start, stop, videoStream };
}
