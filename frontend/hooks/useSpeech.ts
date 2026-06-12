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
    return { isMobile: false, isIOS: false, isSafari: false, isSecure: true };
  }
  const ua = navigator.userAgent || "";
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports as Mac
    (ua.includes("Macintosh") && (navigator as any).maxTouchPoints > 1);
  const isMobile = isIOS || /Android|Mobile|webOS|Opera Mini/i.test(ua);
  const isSafari =
    /Safari/.test(ua) && !/Chrome|Chromium|CriOS|Edg/.test(ua);
  const isSecure =
    window.isSecureContext ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  return { isMobile, isIOS, isSafari, isSecure };
}

export function useSTT(opts: { lang?: string } = {}) {
  const lang = opts.lang ?? "id-ID";
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [paused, setPaused] = useState(false);
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
    // Safari and mobile: `continuous = true` is unreliable — the engine stops
    // after each utterance or short silence. Use single-shot + auto-restart.
    const needsRestart = p.isMobile || p.isSafari;
    rec.continuous = !needsRestart;
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
      // On Safari/mobile the engine ends after each utterance — auto-restart
      // so the session feels continuous until the user explicitly stops.
      if (needsRestart && wantListeningRef.current && !intentionalStopRef.current) {
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
      // `no-speech` is normal between utterances on Safari/mobile — let onend retry
      if (code === "no-speech" && needsRestart && wantListeningRef.current) {
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

  const startEngine = useCallback((opts?: { keepTranscript?: boolean }) => {
    if (!recRef.current) return;
    setError(null);
    if (!opts?.keepTranscript) {
      setTranscript("");
      setInterim("");
    }
    intentionalStopRef.current = false;
    wantListeningRef.current = true;
    try {
      recRef.current.start();
      setListening(true);
      setPaused(false);
    } catch (e: any) {
      wantListeningRef.current = false;
      setError(e?.message ?? "start-failed");
    }
  }, []);

  const start = useCallback(() => startEngine(), [startEngine]);

  // Resume after a pause — keep the captured transcript and append to it.
  const resume = useCallback(
    () => startEngine({ keepTranscript: true }),
    [startEngine],
  );

  const stop = useCallback(() => {
    if (!recRef.current) return;
    intentionalStopRef.current = true;
    wantListeningRef.current = false;
    try {
      recRef.current.stop();
    } catch {}
    setListening(false);
    setPaused(false);
  }, []);

  // Pause the engine but preserve transcript so the user can gather their
  // thoughts without the silence timer auto-sending the turn.
  const pause = useCallback(() => {
    if (!recRef.current) return;
    intentionalStopRef.current = true;
    wantListeningRef.current = false;
    try {
      recRef.current.stop();
    } catch {}
    setListening(false);
    setPaused(true);
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setInterim("");
    setError(null);
  }, []);

  return {
    supported,
    listening,
    paused,
    transcript,
    interim,
    error,
    start,
    stop,
    pause,
    resume,
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

/**
 * Strip Markdown so the synthesizer reads clean prose instead of literally
 * voicing "asterisk asterisk", citation tags, table pipes, etc.
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ") // fenced code
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links -> text
    .replace(/\[[^\]]*,\s*(?:p|hal)\.?\s*\d+\]/gi, "") // citation tags [Name, p.3]
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/(\*\*|__)(.*?)\1/g, "$2") // bold
    .replace(/(\*|_)([^*_]+)\1/g, "$2") // italic
    .replace(/^\s*>\s?/gm, "") // blockquote
    .replace(/^\s*[-*+]\s+/gm, "") // bullet markers
    .replace(/^\s*\d+[.)]\s+/gm, "") // numbered list markers
    .replace(/\|/g, " ") // table pipes
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Break text into sentence-sized chunks. Chrome's speechSynthesis silently
 * cuts off a single long utterance (~15s); feeding it shorter chunks back to
 * back keeps the whole answer from being truncated.
 */
function chunkForSpeech(text: string, maxLen = 180): string[] {
  const sentences = text.match(/[^.!?。！？\n]+[.!?。！？]*\s*/g) || [text];
  const chunks: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if ((buf + s).length > maxLen && buf) {
      chunks.push(buf.trim());
      buf = s;
    } else {
      buf += s;
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}

export function useTTS(opts: { lang?: string } = {}) {
  const lang = opts.lang ?? "id-ID";
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState<string | null>(null); // null = auto
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const queueRef = useRef<string[]>([]);
  const keepAliveRef = useRef<number | null>(null);

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

  const stopKeepAlive = useCallback(() => {
    if (keepAliveRef.current !== null) {
      window.clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
  }, []);

  // Speak the next queued chunk; chains via onend until the queue drains.
  const speakNext = useCallback(() => {
    const synth = window.speechSynthesis;
    const next = queueRef.current.shift();
    if (!next) {
      setSpeaking(false);
      stopKeepAlive();
      return;
    }
    const utter = new SpeechSynthesisUtterance(next);
    if (voiceRef.current) utter.voice = voiceRef.current;
    utter.lang = lang;
    utter.rate = 1.15;
    utter.pitch = 1.05;
    utter.volume = 1.0;
    utter.onend = () => speakNext();
    utter.onerror = () => speakNext();
    synth.speak(utter);
  }, [lang, stopKeepAlive]);

  const speak = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      const clean = stripMarkdown(text || "");
      if (!clean) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      queueRef.current = chunkForSpeech(clean);
      setSpeaking(true);
      // Chrome keep-alive: pausing + resuming every 10s stops the engine from
      // silently dying mid-answer on longer replies.
      stopKeepAlive();
      keepAliveRef.current = window.setInterval(() => {
        if (!synth.speaking) return;
        synth.pause();
        synth.resume();
      }, 10000);
      speakNext();
    },
    [speakNext, stopKeepAlive],
  );

  const cancel = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    queueRef.current = [];
    stopKeepAlive();
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [stopKeepAlive]);

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
