import { useRef, useState, useCallback } from "react";

export interface TranscriptSegment {
  speaker: number;
  text: string;
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
  activeSpeakersRef?: React.MutableRefObject<number[]>
) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const restartIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: { width: 640, height: 480 },
    });
    streamRef.current = stream;
    setVideoStream(stream);

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

    const startRecordingSession = () => {
      const s = streamRef.current;
      const socket = wsRef.current;
      if (!s || !socket || socket.readyState !== WebSocket.OPEN) return;

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(s);
      sourceRef.current = source;

      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const float32Array = e.inputBuffer.getChannelData(0);

        // Calculate RMS audio level
        let sum = 0;
        for (let i = 0; i < float32Array.length; i++) {
          sum += float32Array[i] * float32Array[i];
        }
        const rms = Math.sqrt(sum / float32Array.length);
        setAudioLevel(rms);

        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const int16Array = new Int16Array(float32Array.length);
          for (let i = 0; i < float32Array.length; i++) {
            let s = Math.max(-1, Math.min(1, float32Array[i]));
            int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }

          const bytes = new Uint8Array(int16Array.buffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i += 1) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64data = window.btoa(binary);

          const payload = {
            bytesb64: base64data,
            speakers: activeSpeakersRef?.current || [0]
          };
          wsRef.current?.send(JSON.stringify(payload));
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
    };

    ws.onopen = () => {
      ws.send(JSON.stringify({ mimeType: "audio/pcm" }));
      startRecordingSession();
      setIsRecording(true);
      restartIntervalRef.current = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ newSession: true }));
        }
      }, 20000);
    };
  }, [onTranscript, activeSpeakersRef]);

  const stop = useCallback(() => {
    if (restartIntervalRef.current) {
      clearInterval(restartIntervalRef.current);
      restartIntervalRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    wsRef.current?.close();
    wsRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setVideoStream(null);
    setIsRecording(false);
    setAudioLevel(0);
  }, []);

  return { isRecording, audioLevel, start, stop, videoStream };
}
