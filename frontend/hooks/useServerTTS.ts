"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { authedFetch } from "@/lib/api";

/**
 * Server-side text-to-speech via the backend's ElevenLabs proxy
 * (/api/training/tts). Returns natural MP3 audio that we play with a single
 * reused <audio> element. When the backend has no ElevenLabs key configured,
 * `available` stays false and the caller falls back to the browser's robotic
 * Web Speech API (useTTS).
 *
 * A monotonically increasing `seq` guards against overlap: any new speak() (or
 * cancel()) supersedes an in-flight request/playback, so the customer never
 * talks over itself when replies arrive quickly.
 */
export function useServerTTS() {
  const [available, setAvailable] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    authedFetch("/api/training/tts/available")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAvailable(d?.available === true))
      .catch(() => {});
  }, []);

  const ensureAudio = () => {
    if (!audioRef.current && typeof Audio !== "undefined") {
      audioRef.current = new Audio();
    }
    return audioRef.current;
  };

  const revoke = () => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  };

  const cancel = useCallback(() => {
    seqRef.current++;
    const a = audioRef.current;
    if (a) {
      a.pause();
      try { a.removeAttribute("src"); a.load(); } catch {}
    }
    revoke();
    setSpeaking(false);
  }, []);

  const speak = useCallback(async (text: string, gender: string = "f") => {
    const clean = (text || "").trim();
    if (!clean) return;
    // Supersede anything in-flight or currently playing.
    const seq = ++seqRef.current;
    const a = ensureAudio();
    if (!a) return;
    a.pause();
    revoke();
    setSpeaking(true);
    try {
      const res = await authedFetch("/api/training/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean, gender }),
      });
      if (seq !== seqRef.current) return; // superseded while waiting
      if (!res.ok) throw new Error(`${res.status}`);
      const blob = await res.blob();
      if (seq !== seqRef.current) return;
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      a.src = url;
      a.onended = () => {
        if (seq === seqRef.current) setSpeaking(false);
        revoke();
      };
      a.onerror = () => {
        if (seq === seqRef.current) setSpeaking(false);
      };
      await a.play().catch(() => {
        // Autoplay can be blocked until the first user gesture; the mic tap
        // that starts a turn counts, so subsequent replies play fine.
        if (seq === seqRef.current) setSpeaking(false);
      });
    } catch {
      if (seq === seqRef.current) setSpeaking(false);
    }
  }, []);

  return { available, speaking, speak, cancel };
}
