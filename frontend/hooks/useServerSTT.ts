"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authedFetch } from "@/lib/api";

/**
 * Server-side speech-to-text fallback for browsers that lack the Web Speech
 * API (iOS Safari). Uses MediaRecorder to capture audio, sends it to the
 * backend /api/training/stt/transcribe endpoint (Groq Whisper), and returns
 * the transcribed text.
 *
 * The hook first checks /api/training/stt/available to see if the backend has
 * STT configured. If not, `available` stays false and the UI can hide the mic.
 */
export function useServerSTT(opts: { lang?: string } = {}) {
  const lang = (opts.lang ?? "id-ID").split("-")[0];
  const [available, setAvailable] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    authedFetch("/api/training/stt/available")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setAvailable(d?.available === true))
      .catch(() => {});
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setTranscript("");
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(250);
      recorderRef.current = recorder;
      setRecording(true);
    } catch (e: any) {
      setError(e?.name === "NotAllowedError" ? "not-allowed" : "audio-capture");
    }
  }, []);

  const stop = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setRecording(false);

    const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
    if (blob.size < 1000) {
      setError("no-speech");
      return;
    }

    setProcessing(true);
    try {
      const form = new FormData();
      form.append("audio", blob, "recording.webm");
      form.append("language", lang);
      const res = await authedFetch("/api/training/stt/transcribe", {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setTranscript(data.text || "");
    } catch {
      setError("network");
    } finally {
      setProcessing(false);
    }
  }, [lang]);

  const reset = useCallback(() => {
    setTranscript("");
    setError(null);
  }, []);

  return { available, recording, processing, transcript, error, start, stop, reset };
}
