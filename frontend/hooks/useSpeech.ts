"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Lightweight Web Speech API hooks. Pure browser — no backend dependency.
 * Works in Chrome / Edge (Chromium). Firefox has limited STT support.
 */

// -----------------------------------------------------------------------------
// Speech recognition (STT)
// -----------------------------------------------------------------------------

function detectPlatform() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { isMobile: false, isIOS: false, isSecure: true };
  }
  const ua = navigator.userAgent || "";
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports as Mac
    (ua.includes("Macintosh") && (navigator as any).maxTouchPoints > 1);
  const isMobile = isIOS || /Android|Mobile|webOS|Opera Mini/i.test(ua);
  const isSecure =
    window.isSecureContext ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  return { isMobile, isIOS, isSecure };
}

export function useSTT(opts: { lang?: string } = {}) {
  const lang = opts.lang ?? "id-ID";
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [platform, setPlatform] = useState(() => detectPlatform());
  const recRef = useRef<any>(null);
  // tracks whether stop() was user-initiated; lets us auto-restart on mobile
  // where `continuous` is unreliable and the engine ends after each utterance.
  const intentionalStopRef = useRef(false);
  const wantListeningRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = detectPlatform();
    setPlatform(p);

    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    if (!p.isSecure) {
      // STT requires a secure context — flag as unsupported with a specific error
      setSupported(false);
      setError("insecure-context");
      return;
    }
    setSupported(true);
    const rec = new SR();
    // On mobile, `continuous = true` is flaky (Chrome Android ends recognition
    // after the first utterance). Use single-shot mode + auto-restart.
    rec.continuous = !p.isMobile;
    rec.interimResults = true;
    rec.lang = lang;
    rec.onresult = (e: any) => {
      let finalT = "";
      let interT = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const txt = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalT += txt;
        else interT += txt;
      }
      if (finalT) setTranscript((prev) => (prev + " " + finalT).trim());
      setInterim(interT);
    };
    rec.onend = () => {
      // If we're on mobile and the user hasn't explicitly stopped, restart
      // so the session feels continuous.
      if (p.isMobile && wantListeningRef.current && !intentionalStopRef.current) {
        try {
          rec.start();
          return;
        } catch {
          // fall through to actually stop if restart fails
        }
      }
      wantListeningRef.current = false;
      setListening(false);
    };
    rec.onerror = (e: any) => {
      const code = e?.error ?? "unknown";
      setError(code);
      // `no-speech` on mobile is normal between utterances — let onend retry
      if (code === "no-speech" && p.isMobile && wantListeningRef.current) {
        return;
      }
      wantListeningRef.current = false;
      setListening(false);
    };
    recRef.current = rec;
    return () => {
      wantListeningRef.current = false;
      intentionalStopRef.current = true;
      try {
        rec.stop();
      } catch {}
    };
  }, [lang]);

  const start = useCallback(() => {
    if (!recRef.current) return;
    setError(null);
    setTranscript("");
    setInterim("");
    intentionalStopRef.current = false;
    wantListeningRef.current = true;
    try {
      recRef.current.start();
      setListening(true);
    } catch (e: any) {
      wantListeningRef.current = false;
      setError(e?.message ?? "start-failed");
    }
  }, []);

  const stop = useCallback(() => {
    if (!recRef.current) return;
    intentionalStopRef.current = true;
    wantListeningRef.current = false;
    try {
      recRef.current.stop();
    } catch {}
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setInterim("");
    setError(null);
  }, []);

  return {
    supported,
    listening,
    transcript,
    interim,
    error,
    start,
    stop,
    reset,
    isMobile: platform.isMobile,
    isIOS: platform.isIOS,
    isSecure: platform.isSecure,
  };
}

// -----------------------------------------------------------------------------
// Speech synthesis (TTS)
// -----------------------------------------------------------------------------

const VOICE_PREF_KEY = "bima.tts.voice";

export function useTTS(opts: { lang?: string } = {}) {
  const lang = opts.lang ?? "id-ID";
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState<string | null>(null); // null = auto
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  const scoreVoice = (v: SpeechSynthesisVoice, lng: string) => {
    const n = v.name.toLowerCase();
    let s = 0;
    if (/neural|natural|online|wavenet|studio/.test(n)) s += 100;
    if (n.includes("google")) s += 60;
    if (n.includes("microsoft")) s += 40;
    if (v.lang === lng) s += 20;
    if (!v.localService) s += 5;
    if (/espeak|festival|pico/.test(n)) s -= 50;
    return s;
  };

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setSupported(false);
      return;
    }
    setSupported(true);
    // restore preference
    try {
      const stored = window.localStorage.getItem(VOICE_PREF_KEY);
      if (stored) setVoiceName(stored);
    } catch {}

    const load = () => {
      const all = window.speechSynthesis.getVoices();
      setVoices(all);
      const family = lang.split("-")[0].toLowerCase();
      const langMatches = all.filter(
        (v) => v.lang === lang || v.lang.toLowerCase().startsWith(family),
      );
      const ranked = [...langMatches].sort(
        (a, b) => scoreVoice(b, lang) - scoreVoice(a, lang),
      );
      const auto = ranked[0] || all[0] || null;
      const pick = voiceName
        ? all.find((v) => v.name === voiceName) ?? auto
        : auto;
      voiceRef.current = pick;
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [lang, voiceName]);

  const setVoice = useCallback((name: string | null) => {
    setVoiceName(name);
    try {
      if (typeof window === "undefined") return;
      if (name) window.localStorage.setItem(VOICE_PREF_KEY, name);
      else window.localStorage.removeItem(VOICE_PREF_KEY);
    } catch {}
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      if (!text || !text.trim()) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      if (voiceRef.current) utter.voice = voiceRef.current;
      utter.lang = lang;
      utter.rate = 1.15;
      utter.pitch = 1.05;
      utter.volume = 1.0;
      utter.onstart = () => setSpeaking(true);
      utter.onend = () => setSpeaking(false);
      utter.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utter);
    },
    [lang],
  );

  const cancel = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  return {
    supported,
    speaking,
    speak,
    cancel,
    voices,
    voice: voiceRef.current,
    voiceName,
    setVoice,
  };
}
