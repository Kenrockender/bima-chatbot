"use client";

import { useEffect, useRef, useState } from "react";
import { ChatBubble } from "@/components/ChatBubble";
import { EscalationCard } from "@/components/EscalationCard";
import { PersonaCard, type Persona } from "@/components/PersonaCard";
import { FeedbackReport, type Report } from "@/components/FeedbackReport";
import { CoachChip, type Coach } from "@/components/CoachChip";
import { VoiceStage } from "@/components/VoiceStage";
import { AppShell } from "@/components/AppShell";
import { useConfirm } from "@/components/ConfirmModal";
import { useSTT, useTTS } from "@/hooks/useSpeech";
import { useServerSTT } from "@/hooks/useServerSTT";
import { authedFetch } from "@/lib/api";
import { clearCache } from "@/lib/swr";
import { recommendedPersona } from "@/lib/coaching";
import { t, type Lang } from "@/lib/i18n";

type Message = {
  role: "user" | "assistant";
  content: string;
  facts?: { name?: string; page?: number | null }[];
  coach?: Coach | null;
  escalation?: boolean;
  streaming?: boolean;
  timestamp?: Date;
};

type Stage = "pick" | "chat" | "report" | "ending";

export type CustomConfig = {
  name?: string;
  background?: string;
  needs?: string;
  challenge?: string;
};

// Persona id reserved for the FA-defined custom persona.
const CUSTOM_ID = "custom";

// Order prospects easy → hard so trainees can ramp up gradually.
const DIFFICULTY_RANK: Record<string, number> = { Mudah: 0, Sedang: 1, Sulit: 2 };

// Difficulty → dot colour, mirroring PersonaCard so the mobile picker reads the same.
const CHALLENGE_DOT: Record<string, string> = {
  Mudah: "#1E7B47",
  Easy: "#1E7B47",
  Sedang: "#2E86C1",
  Medium: "#2E86C1",
  Sulit: "#E0533D",
  Hard: "#E0533D",
};
function sortByDifficulty(list: Persona[]): Persona[] {
  if (!Array.isArray(list)) return [];
  return [...list].sort(
    (a, b) =>
      (DIFFICULTY_RANK[a.challenge] ?? 99) - (DIFFICULTY_RANK[b.challenge] ?? 99),
  );
}

export default function Home() {
  const [confirmModal, askConfirm] = useConfirm();
  const [lang, setLang] = useState<Lang>("id");
  const [stage, setStage] = useState<Stage>("pick");
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [personaError, setPersonaError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activePersona, setActivePersona] = useState<Persona | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [inputMode, setInputMode] = useState<"voice" | "text">(() => {
    if (typeof window === "undefined") return "text";
    try { return (localStorage.getItem("bima.inputMode") as "voice" | "text") || "text"; } catch { return "text"; }
  });
  const [silenceProgress, setSilenceProgress] = useState(0);
  const silenceStartRef = useRef<number | null>(null);
  const silenceRafRef = useRef<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [listenStart, setListenStart] = useState<number | null>(null);
  const [listenSeconds, setListenSeconds] = useState(0);
  const [aiSubtitle, setAiSubtitle] = useState("");
  const [lastCoach, setLastCoach] = useState<Coach | null>(null);
  const [lastFacts, setLastFacts] = useState<{ name?: string; page?: number | null }[] | null>(null);
  const [lastFailedMsg, setLastFailedMsg] = useState<string | null>(null);
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const voiceInitRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tr = t[lang];

  // The custom persona is rendered as a distinct CTA, not a regular card.
  const customPersona = personas.find((p) => p.id === CUSTOM_ID) ?? null;
  const presetPersonas = personas.filter((p) => p.id !== CUSTOM_ID);

  const speechLang = lang === "id" ? "id-ID" : "en-US";
  const stt = useSTT({ lang: speechLang });
  const tts = useTTS({ lang: speechLang });
  const serverSTT = useServerSTT({ lang: speechLang });
  const hasVoice = stt.supported || serverSTT.available;

  useEffect(() => {
    if (stt.listening) setInput((stt.transcript + " " + stt.interim).trim());
  }, [stt.transcript, stt.interim, stt.listening]);

  // Server STT fallback: when transcription completes, populate input and auto-send.
  useEffect(() => {
    if (serverSTT.transcript && !serverSTT.processing) {
      setInput(serverSTT.transcript);
      send(serverSTT.transcript);
      serverSTT.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSTT.transcript, serverSTT.processing]);

  useEffect(() => {
    if (stt.listening) {
      const start = Date.now();
      setListenStart(start);
      setListenSeconds(0);
      const id = setInterval(() => {
        setListenSeconds((Date.now() - start) / 1000);
      }, 100);
      return () => clearInterval(id);
    }
    setListenStart(null);
    setListenSeconds(0);
  }, [stt.listening]);

  function loadPersonas() {
    setPersonaError(false);
    try {
      const cached = sessionStorage.getItem("bima.personas");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPersonas(sortByDifficulty(parsed));
          return;
        }
      }
    } catch {}
    authedFetch("/api/training/personas")
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(sortByDifficulty)
      .then((sorted) => {
        setPersonas(sorted);
        try { sessionStorage.setItem("bima.personas", JSON.stringify(sorted)); } catch {}
      })
      .catch(() => { setPersonas([]); setPersonaError(true); });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadPersonas(); }, []);

  // Restore an in-progress session after page refresh.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (stage !== "pick" || sessionId) return;
    try {
      const raw = sessionStorage.getItem("bima.session");
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.session_id && saved.persona) {
          setSessionId(saved.session_id);
          setActivePersona(saved.persona);
          setSelectedId(saved.persona.id);
          setMessages([{ role: "assistant", content: saved.opening ?? "", timestamp: new Date(saved.started) }]);
          setStage("chat");
          setSessionStart(saved.started);
          return;
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deep-link auto-start: the progress dashboard links here with ?persona=…
  // or ?drill=… to jump straight into a recommended session.
  useEffect(() => {
    if (typeof window === "undefined" || personas.length === 0) return;
    if (stage !== "pick" || sessionId) return;
    const params = new URLSearchParams(window.location.search);
    const drill = params.get("drill");
    const personaId = params.get("persona");
    if (drill) {
      startSession(null, drill);
      window.history.replaceState(null, "", window.location.pathname);
    } else if (personaId) {
      const p = personas.find((x) => x.id === personaId);
      if (p) startSession(p);
      window.history.replaceState(null, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personas]);

  useEffect(() => {
    if (!voiceInitRef.current && hasVoice) {
      voiceInitRef.current = true;
      try {
        if (!localStorage.getItem("bima.inputMode")) setInputMode("voice");
      } catch { setInputMode("voice"); }
    }
  }, [hasVoice]);

  useEffect(() => {
    try { localStorage.setItem("bima.inputMode", inputMode); } catch {}
  }, [inputMode]);

  useEffect(() => {
    if (!stt.listening) {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (silenceRafRef.current) cancelAnimationFrame(silenceRafRef.current);
      silenceStartRef.current = null;
      setSilenceProgress(0);
      return;
    }
    const captured = (stt.transcript + " " + stt.interim).trim();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (silenceRafRef.current) cancelAnimationFrame(silenceRafRef.current);
    silenceStartRef.current = null;
    setSilenceProgress(0);
    if (captured) {
      const SILENCE_MS = 3000;
      silenceStartRef.current = Date.now();
      const tick = () => {
        if (!silenceStartRef.current) return;
        const elapsed = Date.now() - silenceStartRef.current;
        setSilenceProgress(Math.min(elapsed / SILENCE_MS, 1));
        if (elapsed < SILENCE_MS) silenceRafRef.current = requestAnimationFrame(tick);
      };
      silenceRafRef.current = requestAnimationFrame(tick);
      silenceTimerRef.current = setTimeout(() => {
        if (stt.listening) toggleMic();
      }, SILENCE_MS);
    }
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (silenceRafRef.current) cancelAnimationFrame(silenceRafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stt.transcript, stt.interim, stt.listening]);

  useEffect(() => {
    if (!sessionStart) { setSessionElapsed(0); return; }
    const id = setInterval(() => setSessionElapsed(Math.floor((Date.now() - sessionStart) / 1000)), 1000);
    return () => clearInterval(id);
  }, [sessionStart]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy]);

  async function startSession(
    persona: Persona | null,
    drillId?: string,
    custom?: CustomConfig,
  ) {
    if (starting) return;
    setStarting(true);
    setStartError(false);
    try {
      const res = await authedFetch("/api/training/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona_id: persona?.id ?? "",
          drill_id: drillId ?? null,
          custom: custom ?? null,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSessionId(data.session_id);
      setActivePersona(data.persona);
      setSelectedId(data.persona.id);
      setMessages([
        {
          role: "assistant",
          content: data.opening_message,
          timestamp: new Date(),
        },
      ]);
      setStage("chat");
      setSessionStart(Date.now());
      setTimeout(() => inputRef.current?.focus(), 100);
      setAiSubtitle(data.opening_message);
      try {
        sessionStorage.setItem("bima.session", JSON.stringify({
          session_id: data.session_id,
          persona: data.persona,
          opening: data.opening_message,
          started: Date.now(),
        }));
      } catch {}
      setLastCoach(null);
      setLastFacts(null);
      if (inputMode === "voice" && !muted && tts.supported) {
        setTimeout(() => tts.speak(data.opening_message), 250);
      }
    } catch {
      setStartError(true);
    } finally {
      setStarting(false);
    }
  }

  // Replace the most recent assistant bubble (the streaming placeholder) with
  // a new message, or patch its fields. Keeps streaming updates O(1).
  function patchLastAssistant(prev: Message[], patch: Partial<Message>): Message[] {
    const copy = [...prev];
    for (let i = copy.length - 1; i >= 0; i--) {
      if (copy[i].role === "assistant") {
        copy[i] = { ...copy[i], ...patch };
        return copy;
      }
    }
    return copy;
  }

  function commitAssistant(
    reply: string,
    coachData: Coach | null,
    factsData: Message["facts"] | null,
  ) {
    setMessages((prev) =>
      patchLastAssistant(prev, {
        content: reply,
        facts: factsData ?? undefined,
        coach: coachData,
        streaming: false,
      }),
    );
    setAiSubtitle(reply);
    setLastCoach(coachData);
    setLastFacts(factsData ?? null);
    if (inputMode === "voice" && !muted && tts.supported) tts.speak(reply);
  }

  // Streamed reply via SSE. Returns true if it produced usable text, false if
  // the stream never started (caller then falls back to the plain POST). On a
  // mid-stream break we keep whatever streamed — never re-submit, to avoid
  // duplicating the turn in the server-side session.
  async function streamReply(text: string): Promise<boolean> {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let res: Response;
    try {
      res = await authedFetch("/api/training/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ session_id: sessionId, message: text }),
        signal: ctrl.signal,
      });
    } catch {
      return false;
    }
    if (!res.ok || !res.body) return false;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let acc = "";
    let finished = false;

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop() ?? "";
        for (const evt of events) {
          const line = evt.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          let data: any;
          try {
            data = JSON.parse(payload);
          } catch {
            continue;
          }
          if (data.type === "token") {
            acc += data.v;
            const live = acc;
            setAiSubtitle(live);
            setMessages((prev) =>
              patchLastAssistant(prev, { content: live, streaming: true }),
            );
          } else if (data.type === "done") {
            commitAssistant(
              data.reply ?? acc,
              data.coach ?? null,
              data.facts_referenced ?? null,
            );
            finished = true;
          } else if (data.type === "error") {
            return acc.length > 0;
          }
        }
      }
    } catch {
      // Mid-stream break: keep partial text rather than re-submitting.
    }

    if (finished) return true;
    if (acc.length > 0) {
      commitAssistant(acc, null, null);
      return true;
    }
    return false;
  }

  // Non-streaming fallback. Patches the placeholder assistant bubble.
  async function jsonReply(text: string): Promise<void> {
    const signal = abortRef.current?.signal;
    const res = await authedFetch("/api/training/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, message: text }),
      signal,
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    commitAssistant(data.reply, data.coach ?? null, data.facts_referenced ?? null);
  }

  async function send(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || busy || !sessionId) return;
    setLastFailedMsg(null);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text, timestamp: new Date() },
      // Placeholder assistant bubble that streaming/fallback fills in.
      { role: "assistant", content: "", streaming: true, timestamp: new Date() },
    ]);
    setInput("");
    setBusy(true);
    try {
      const streamed = await streamReply(text);
      if (!streamed) await jsonReply(text);
    } catch {
      setLastFailedMsg(text);
      setMessages((prev) =>
        patchLastAssistant(prev, {
          content:
            tr.connectionError,
          escalation: true,
          streaming: false,
        }),
      );
    } finally {
      setBusy(false);
    }
  }

  function retry() {
    if (!lastFailedMsg) return;
    const msg = lastFailedMsg;
    setMessages((prev) => prev.filter((m) => !m.escalation || m !== prev[prev.length - 1]));
    setLastFailedMsg(null);
    send(msg);
  }

  async function endSession() {
    if (!sessionId) return;
    const ok = await askConfirm(tr.endSessionConfirm, {
      confirmLabel: tr.endSession,
      cancelLabel: lang === "id" ? "Batal" : "Cancel",
      destructive: true,
    });
    if (!ok) return;
    setStage("ending");
    try {
      const res = await authedFetch("/api/training/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setReport(data);
      setStage("report");
      try { sessionStorage.removeItem("bima.session"); } catch {}
      // Stats just changed — drop cached dashboards so a visit to Progress/
      // Leaderboard reflects the new XP immediately instead of stale numbers.
      clearCache("progress");
      clearCache("leaderboard");
    } catch {
      setStartError(true);
      setStage("chat");
    }
  }

  function resetToPicker() {
    setStage("pick");
    setSelectedId(null);
    setActivePersona(null);
    setSessionId(null);
    setSessionStart(null);
    setMessages([]);
    setReport(null);
    setInput("");
    try { sessionStorage.removeItem("bima.session"); } catch {}
    abortRef.current?.abort();
    if (stt.listening || stt.paused) stt.stop();
    if (tts.speaking) tts.cancel();
  }

  function toggleMic() {
    // Server STT fallback (iOS/Safari)
    if (!stt.supported && serverSTT.available) {
      if (serverSTT.recording) {
        serverSTT.stop();
      } else {
        if (tts.speaking) tts.cancel();
        serverSTT.start();
      }
      return;
    }
    if (!stt.supported) return;
    if (stt.listening || stt.paused) {
      stt.stop();
      const finalText = (stt.transcript + " " + stt.interim).trim();
      if (finalText) {
        send(finalText);
        stt.reset();
      }
    } else {
      if (tts.speaking) tts.cancel();
      stt.start();
    }
  }

  function pauseMic() {
    if (stt.listening) stt.pause();
    else if (stt.paused) stt.resume();
  }

  // Rekam ulang: clear what's captured so far and keep (or resume) listening.
  function redoMic() {
    stt.reset();
    if (stt.paused) stt.resume();
    else if (!stt.listening) stt.start();
  }

  function onPickPersona(p: Persona) {
    setSelectedId(p.id);
    // If we're already in chat with a different persona, do not auto-switch — user must end first.
    if (stage === "pick") {
      // immediate start would be too aggressive; show a Start button in the welcome card
    }
  }

  const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const voiceMode = inputMode === "voice";
  const voiceState = stt.listening || stt.paused
    ? "recording" as const
    : busy
      ? "processing" as const
      : tts.speaking
        ? "speaking" as const
        : "idle" as const;

  const placeholder =
    voiceMode && (stt.supported || serverSTT.available) ? tr.tapToSpeak : tr.placeholder;

  const sttErrorMessage = (() => {
    if (!stt.error) return null;
    switch (stt.error) {
      case "not-allowed":
      case "permission-denied":
        return tr.voiceErrNotAllowed;
      case "service-not-allowed":
      case "insecure-context":
        return tr.voiceErrInsecure;
      case "no-speech":
        // benign on mobile (we auto-restart); hide unless we've actually stopped
        return stt.listening ? null : tr.voiceErrNoSpeech;
      case "audio-capture":
        return tr.voiceErrAudio;
      case "network":
        return tr.voiceErrNetwork;
      default:
        return tr.voiceErrGeneric;
    }
  })();

  const unsupportedMessage = stt.isIOS
    ? tr.voiceUnsupportedIOS
    : tr.voiceUnsupported;

  return (
    <AppShell lang={lang} onLang={setLang} current="home" fill>
      {confirmModal}
      {/* Accent band — blue→teal BCA Life gradient, same signature as every page */}
      <section className="life-gradient relative overflow-hidden shrink-0">
        <div
          aria-hidden
          className="absolute rounded-full"
          style={{
            width: 420, height: 420, right: -120, top: -180,
            background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.16), rgba(255,255,255,0))",
          }}
        />
        <div
          aria-hidden
          className="absolute rounded-full"
          style={{
            width: 280, height: 280, left: -90, bottom: -150,
            background: "radial-gradient(circle at 50% 50%, rgba(25,184,166,0.35), rgba(25,184,166,0))",
          }}
        />
        <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-8 pt-7 pb-12 animate-riseIn">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-white/90" />
            <span className="h-1 w-10 rounded-full bg-white/70" />
            <span className="ml-1 text-[11.5px] font-bold uppercase tracking-[0.13em] text-white/85">
              {tr.brandLine}
            </span>
          </div>
          <h2
            className="font-sans font-extrabold text-white text-[27px] sm:text-[34px] leading-[1.08] tracking-tight"
            style={{ letterSpacing: "-0.025em" }}
          >
            {tr.navTrain}
          </h2>
        </div>
      </section>

      <div className="relative z-10 -mt-7 flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 pb-4 sm:pb-6 flex flex-col min-h-0">
        {/* Active-session context bar (persona, timer, end session) */}
        {stage === "chat" && activePersona && (
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-life-amber shrink-0" />
              <span className="text-[13.5px] font-semibold text-life-heading truncate">
                {activePersona.name}
              </span>
              <span className="hidden sm:inline text-[11px] text-life-body shrink-0">
                · {tr.challengeLabel}: {activePersona.challenge}
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {sessionStart && (
                <span className="text-[12px] font-mono text-life-body tabular-nums">
                  {fmtTime(sessionElapsed)}
                </span>
              )}
              <button
                onClick={endSession}
                className="inline-flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-life-body hover:text-life-blue px-3 py-2 rounded-full border border-life-blue/15 hover:border-life-blue/50 transition"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-life-amber" />
                {tr.endSession}
              </button>
            </div>
          </div>
        )}

        {/* ─── Chat surface: persona sidebar + chat, in a card like every other page ─── */}
        <div className="life-card flex-1 flex min-h-0 overflow-hidden">
          {/* Sidebar */}
          <aside className="hidden md:flex flex-col gap-3 w-[280px] shrink-0 px-4 py-5 border-r border-life-blue/10 overflow-y-auto scroll-stylish">
            <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-life-bodyLight px-1 mb-1">
              {tr.pickPersona}
            </div>
            {presetPersonas.map((p) => (
              <PersonaCard
                key={p.id}
                persona={p}
                selected={selectedId === p.id}
                active={activePersona?.id === p.id}
                onSelect={onPickPersona}
                challengeLabel={tr.challengeLabel}
              />
            ))}
            {customPersona && (
              <CustomCta
                label={tr.customCardCta}
                selected={(activePersona?.id ?? selectedId) === CUSTOM_ID}
                onClick={() => onPickPersona(customPersona)}
              />
            )}
            {personas.length === 0 && (
              personaError ? (
                <button
                  onClick={loadPersonas}
                  className="text-[12px] px-1 py-3 text-life-neg hover:text-life-blue transition"
                >
                  {tr.fetchError}{" "}
                  <span className="underline">{tr.retry}</span>
                </button>
              ) : (
                <div className="space-y-3 animate-fadeIn">
                  {[1,2,3].map(i => (
                    <div key={i} className="tile-persona p-3 space-y-2">
                      <div className="skeleton h-4 w-24" />
                      <div className="skeleton h-3 w-36" />
                      <div className="skeleton h-3 w-16" />
                    </div>
                  ))}
                </div>
              )
            )}
          </aside>

          {/* Main chat area */}
          <section className="flex-1 flex flex-col min-w-0 p-4 sm:p-5">
            <div className="flex-1 bg-chatpanel flex flex-col min-h-0 overflow-hidden">
              {/* Mobile persona picker — wraps so every persona is visible at once (no horizontal scroll) */}
              <div className="md:hidden flex flex-wrap gap-2 px-3 py-3 border-b border-life-blue/8">
                {presetPersonas.map((p) => {
                  const isOn = (activePersona?.id ?? selectedId) === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => onPickPersona(p)}
                      title={`${p.title} — ${p.summary} (${tr.challengeLabel}: ${p.challenge})`}
                      aria-pressed={isOn}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition ${
                        isOn
                          ? "bg-life-blue text-white"
                          : "bg-white text-life-body border border-life-blue/12"
                      }`}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: CHALLENGE_DOT[p.challenge] ?? "#F9B233" }}
                      />
                      {p.name}
                    </button>
                  );
                })}
                {customPersona && (
                  <button
                    onClick={() => onPickPersona(customPersona)}
                    aria-pressed={(activePersona?.id ?? selectedId) === CUSTOM_ID}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-semibold border border-dashed transition ${
                      (activePersona?.id ?? selectedId) === CUSTOM_ID
                        ? "bg-life-blue text-white border-transparent"
                        : "bg-life-white/60 text-life-body border-life-blue/25"
                    }`}
                  >
                    + {tr.customCardCta}
                  </button>
                )}
              </div>

              {/* Scrolling messages or welcome / report */}
              <div
                ref={scrollRef}
                role="log"
                aria-live="polite"
                aria-relevant="additions"
                className="flex-1 overflow-y-auto scroll-stylish px-4 sm:px-7 py-6"
              >
                {stage === "pick" && <Welcome
                  tr={tr}
                  selected={personas.find((x) => x.id === selectedId) ?? null}
                  starting={starting}
                  error={startError}
                  onStart={startSession}
                  onStartCustom={(cfg) =>
                    startSession({ id: CUSTOM_ID } as Persona, undefined, cfg)
                  }
                />}

                {stage === "ending" && <EndingState tr={tr} />}

                {stage === "report" && report && (
                  <FeedbackReport
                    report={report}
                    onTryAgain={resetToPicker}
                    recommendedPersonaId={recommendedPersona(report.scores)}
                    onPractice={(pid) => {
                      const p = personas.find((x) => x.id === pid);
                      if (p) startSession(p);
                    }}
                    labels={{
                      eyebrow: tr.reportEyebrow,
                      title: tr.reportTitle,
                      overall: tr.reportOverall,
                      scores: tr.reportScores,
                      strengths: tr.reportStrengths,
                      improvements: tr.reportImprovements,
                      next: tr.reportNext,
                      turns: tr.reportTurns,
                      tryAgain: tr.tryAgain,
                      rapport: tr.rapport,
                      discovery: tr.discovery,
                      product_knowledge: tr.product_knowledge,
                      objection_handling: tr.objection_handling,
                      closing: tr.closing,
                      xpEarned: tr.xpEarned,
                      streak: tr.streakLabel,
                      newBadge: tr.newBadgeLabel,
                      level: tr.levelLabel,
                      practiceWeakest: tr.practiceWeakest,
                      saved: tr.savedToProgress,
                    }}
                  />
                )}

                {stage === "chat" && activePersona && voiceMode && (
                  <VoiceStage
                    voiceState={voiceState}
                    personaName={activePersona.name}
                    personaDifficulty={tr.challengeLabel}
                    sessionTimer={sessionStart ? fmtTime(sessionElapsed) : null}
                    aiSubtitle={aiSubtitle}
                    userCaption={(stt.transcript + " " + stt.interim).trim()}
                    userInterim={!!stt.interim}
                    silenceProgress={silenceProgress}
                    paused={stt.paused}
                    coach={lastCoach}
                    facts={null}
                    onMicClick={toggleMic}
                    onPauseToggle={pauseMic}
                    onRedo={redoMic}
                    onSwitchToText={() => {
                      setInputMode("text");
                      if (stt.listening || stt.paused) stt.stop();
                      if (tts.speaking) tts.cancel();
                    }}
                    onMuteToggle={() => {
                      if (!muted && tts.speaking) tts.cancel();
                      setMuted((m) => !m);
                    }}
                    onEndSession={endSession}
                    muted={muted}
                    sttError={stt.error}
                    sttErrorMessage={sttErrorMessage}
                    labels={{
                      switchToText: tr.switchToText,
                      readyToListen: tr.readyToListen,
                      recording: tr.recording,
                      processingVoice: tr.processingVoice,
                      aiSpeaking: tr.aiSpeaking,
                      tapToInterrupt: tr.tapToInterrupt,
                      mute: tr.mute,
                      unmute: tr.unmute,
                      endSession: tr.endSession,
                      coachLabel: tr.coachLabel,
                      factsTag: tr.factsTag,
                      voiceErrDismiss: tr.voiceErrDismiss,
                      pauseRec: tr.pauseRec,
                      resumeRec: tr.resumeRec,
                      redoRec: tr.redoRec,
                      pausedStatus: tr.pausedStatus,
                    }}
                  />
                )}

                {stage === "chat" && activePersona && !voiceMode && (
                  <>
                    {messages.map((m, i) => {
                      // Hide the empty streaming placeholder until its first
                      // token lands — the TypingIndicator covers that gap.
                      const isEmptyStreaming =
                        m.role === "assistant" && m.streaming && !m.content;
                      if (isEmptyStreaming) return <div key={i} />;
                      return (
                      <div key={i}>
                        {m.role === "assistant" && m.coach && (
                          <CoachChip coach={m.coach} label={tr.coachLabel} />
                        )}
                        <ChatBubble
                          role={m.role}
                          content={
                            m.streaming && m.content ? m.content + " ▍" : m.content
                          }
                          youLabel="USER"
                          bimaLabel={activePersona.name.toUpperCase()}
                          timestamp={m.timestamp}
                        />
                        {m.escalation && (
                          <>
                            <EscalationCard
                              whatsapp="+62 812-1234-5678"
                              email="hr-it@bcalife.co.id"
                              title={tr.needDirectHelp}
                              body={tr.teamReady}
                              whatsappLabel="WhatsApp"
                              emailLabel="Email"
                            />
                            {lastFailedMsg && i === messages.length - 1 && (
                              <button
                                onClick={retry}
                                disabled={busy}
                                className="mt-1.5 ml-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-life-blue hover:text-life-heading bg-life-blueBg hover:bg-life-blue/15 border border-life-blue/15 rounded-full px-3.5 py-1.5 transition disabled:opacity-50"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
                                {tr.retry}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                      );
                    })}
                    {busy &&
                      (() => {
                        const last = messages[messages.length - 1];
                        const streamingStarted =
                          last && last.role === "assistant" && !!last.content;
                        return streamingStarted ? null : (
                          <TypingIndicator label={tr.thinking} />
                        );
                      })()}
                  </>
                )}
              </div>

              {/* Footer input bar — hidden in voice mode during chat */}
              {((stage === "chat" && !voiceMode) || stage === "pick") && (
                <div className="border-t border-life-blue/8 px-3 sm:px-4 py-3 bg-life-white/30 backdrop-blur-sm">
                  {/* Voice error banner */}
                  {(sttErrorMessage || (voiceMode && !stt.supported && !serverSTT.available)) && (
                    <div
                      role="alert"
                      className="mb-2 flex items-start gap-2 rounded-lg border border-red-300/60 bg-red-50/90 px-3 py-2 text-[12px] text-red-800"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        className="mt-0.5 shrink-0"
                        aria-hidden
                      >
                        <path
                          d="M12 2L1 21h22L12 2zm0 6v6m0 3v.5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span className="flex-1 leading-snug">
                        {sttErrorMessage ?? unsupportedMessage}
                      </span>
                      {sttErrorMessage && (
                        <button
                          onClick={() => stt.reset()}
                          className="shrink-0 text-red-700/70 hover:text-red-900 text-[11px] uppercase tracking-wide font-semibold"
                        >
                          {tr.voiceErrDismiss}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Voice controls row */}
                  <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                    <button
                      onClick={() => {
                        const next = inputMode === "voice" ? "text" : "voice";
                        setInputMode(next);
                        if (next === "text") {
                          if (stt.listening || stt.paused) stt.stop();
                          if (tts.speaking) tts.cancel();
                        }
                      }}
                      disabled={!hasVoice && !tts.supported}
                      title={
                        !stt.supported && !tts.supported
                          ? unsupportedMessage
                          : tr.voiceMode
                      }
                      className={`inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.14em] font-bold px-3 py-1.5 rounded-full border transition disabled:opacity-40 disabled:cursor-not-allowed ${
                        voiceMode
                          ? "bg-life-blue text-white border-life-blue shadow-lifeBlue"
                          : "bg-life-white/60 text-life-body border-life-blue/15 hover:border-life-blue/40"
                      }`}
                    >
                      <SpeakerIcon active={voiceMode} />
                      <span>{voiceMode ? tr.voiceOn : tr.voiceOff}</span>
                    </button>

                    {voiceMode && tts.supported && (
                      <button
                        onClick={() => {
                          if (!muted && tts.speaking) tts.cancel();
                          setMuted((m) => !m);
                        }}
                        title={muted ? tr.unmute : tr.mute}
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-full border transition ${
                          muted
                            ? "bg-life-white/60 text-life-bodyLight border-life-blue/15"
                            : "bg-life-blue text-white border-life-blue"
                        }`}
                      >
                        {muted ? <MuteIcon /> : <PlayIcon />}
                      </button>
                    )}

                    {voiceMode && tts.supported && tts.voices.length > 0 && (
                      <VoicePicker
                        voices={tts.voices}
                        lang={speechLang}
                        selectedName={tts.voiceName}
                        autoLabel={tr.voiceAuto}
                        pickerLabel={tr.voicePicker}
                        testLabel={tr.voiceTest}
                        sample={tr.voiceTestSample}
                        onSelect={(name) => {
                          if (tts.speaking) tts.cancel();
                          tts.setVoice(name);
                        }}
                        onTest={() => {
                          if (tts.speaking) tts.cancel();
                          tts.speak(tr.voiceTestSample);
                        }}
                      />
                    )}

                    {/* Status pill (right side of voice row) */}
                    <div className="ml-auto hidden sm:flex items-center gap-2 pr-1">
                      {stt.listening ? (
                        <>
                          <span className="eq-bars" aria-hidden>
                            <span /><span /><span /><span /><span /><span /><span />
                          </span>
                          <span className="text-[11px] font-semibold text-red-600 tabular-nums">
                            {tr.listening.replace(/…|\.\.\./g, "")} ({listenSeconds.toFixed(1)}s)
                          </span>
                        </>
                      ) : tts.speaking ? (
                        <>
                          <span className="eq-bars" aria-hidden>
                            <span /><span /><span /><span /><span /><span /><span />
                          </span>
                          <span className="text-[11px] font-semibold text-life-blue">
                            {tr.speakingNow}
                          </span>
                        </>
                      ) : (
                        <span className="text-[10.5px] uppercase tracking-[0.16em] text-bca-ink/40">
                          {voiceMode && stt.supported
                            ? tr.tapToSpeak
                            : !stt.supported && voiceMode
                            ? unsupportedMessage
                            : tr.enterHint.split("·")[0].trim()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Input pill */}
                    <div className="input-pill flex-1 flex items-center gap-2 px-4 sm:px-5 py-2.5">
                      <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (stage === "chat") send();
                          }
                        }}
                        placeholder={stage === "chat" ? placeholder : (lang === "id" ? "Pilih persona dulu, lalu mulai sesi…" : "Pick a persona, then start a session…")}
                        disabled={stage !== "chat"}
                        className="flex-1 bg-transparent outline-none text-[14px] text-bca-ink placeholder:text-bca-ink/40 disabled:text-bca-ink/40 disabled:placeholder:text-bca-ink/30"
                      />
                      <button
                        onClick={() => {
                          if (stage !== "chat") return;
                          if (!hasVoice) {
                            setInputMode(inputMode === "voice" ? "text" : "voice");
                            return;
                          }
                          if (inputMode !== "voice") setInputMode("voice");
                          toggleMic();
                        }}
                        disabled={stage !== "chat" || busy}
                        title={stt.listening || serverSTT.recording ? tr.listening : tr.tapToSpeak}
                        className={`btn-gold-circle shrink-0 ${stt.listening || serverSTT.recording ? "ring-4 ring-red-500/40" : ""}`}
                        style={{ width: 38, height: 38 }}
                      >
                        <MicIcon />
                      </button>
                    </div>

                    {/* Send circle */}
                    <button
                      onClick={() => send()}
                      disabled={stage !== "chat" || busy || !input.trim()}
                      title={tr.send}
                      aria-label={tr.send}
                      className="btn-gold-circle shrink-0"
                    >
                      <SendIcon />
                    </button>
                  </div>

                  {/* secondary row: persona quick-start / status */}
                  {stage === "pick" && selectedId && selectedId !== CUSTOM_ID && (
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <span className="text-[11px] text-bca-ink/55">
                        {personas.find((p) => p.id === selectedId)?.name}
                      </span>
                      <button
                        onClick={() => {
                          const p = personas.find((x) => x.id === selectedId);
                          if (p) startSession(p);
                        }}
                        disabled={starting}
                        className="inline-flex items-center gap-2 bg-life-blue hover:brightness-110 text-white text-[12.5px] font-semibold rounded-full px-4 py-2 shadow-soft transition disabled:opacity-60"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-life-amber" />
                        {starting ? "…" : tr.startSession}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

// ─────────────────────────── helpers ───────────────────────────

function CustomCta({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`group w-full mt-1 flex items-center gap-2.5 px-2.5 py-2 rounded-xl border border-dashed transition ${
        selected
          ? "bg-life-blueBg border-life-blue/50 text-life-heading"
          : "border-life-blue/25 text-life-body hover:border-life-blue/50 hover:text-life-heading"
      }`}
    >
      <span
        className="shrink-0 grid place-items-center rounded-full border border-current"
        style={{ width: 32, height: 32, fontSize: 18, lineHeight: 1 }}
      >
        +
      </span>
      <span className="flex-1 min-w-0 text-[13px] font-semibold truncate">
        {label}
      </span>
    </button>
  );
}

function Welcome({
  tr,
  selected,
  starting,
  error,
  onStart,
  onStartCustom,
}: {
  tr: (typeof t)["en"] | (typeof t)["id"];
  selected: Persona | null;
  starting: boolean;
  error?: boolean;
  onStart: (p: Persona) => void;
  onStartCustom: (cfg: CustomConfig) => void;
}) {
  const isCustom = selected?.id === CUSTOM_ID;
  return (
    <div className="max-w-[640px] mx-auto py-6 animate-fadeIn">
      <div className="inline-flex items-center gap-2 mb-4">
        <span className="w-6 h-px bg-life-amber" />
        <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-life-amberDark">
          {tr.brandLine}
        </span>
      </div>
      <h2
        className="font-sans font-extrabold text-life-heading text-[34px] sm:text-[40px] leading-[1.1] tracking-tight mb-4"
        style={{ letterSpacing: "-0.025em" }}
      >
        {tr.landingHeadline}
      </h2>
      <p className="text-[15px] leading-[1.65] text-life-body mb-6 max-w-[560px]">
        {tr.landingSubtitle}
      </p>

      <div className="bubble-bima max-w-[460px]">
        <p className="text-[13.5px] leading-[1.6]">
          {selected
            ? isCustom
              ? tr.customIntro
              : `${tr.pickPersona}: ${selected.name} · ${selected.title}. ${selected.summary}`
            : tr.pickPersonaHint}
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-life-neg/30 bg-life-negBg px-4 py-3 text-[13px] text-life-neg max-w-[460px]">
          {tr.fetchError}
        </div>
      )}

      {isCustom ? (
        <CustomPersonaForm tr={tr} starting={starting} onStart={onStartCustom} />
      ) : (
        selected && (
          <div className="mt-5">
            <button
              onClick={() => onStart(selected)}
              disabled={starting}
              className="inline-flex items-center gap-2 bg-life-blue hover:brightness-110 text-white text-[13.5px] font-semibold rounded-full px-5 py-3 shadow-soft transition disabled:opacity-60"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-life-amber" />
              {starting ? "…" : tr.startSession}
            </button>
          </div>
        )
      )}
    </div>
  );
}

function CustomPersonaForm({
  tr,
  starting,
  onStart,
}: {
  tr: (typeof t)["en"] | (typeof t)["id"];
  starting: boolean;
  onStart: (cfg: CustomConfig) => void;
}) {
  const [name, setName] = useState("");
  const [background, setBackground] = useState("");
  const [needs, setNeeds] = useState("");
  const [challenge, setChallenge] = useState("Sedang");

  const ready = background.trim().length > 0 || needs.trim().length > 0;

  function submit() {
    if (!ready || starting) return;
    onStart({
      name: name.trim() || undefined,
      background: background.trim() || undefined,
      needs: needs.trim() || undefined,
      challenge,
    });
  }

  return (
    <div className="mt-5 rounded-2xl border border-life-blue/12 bg-white p-5 max-w-[520px] shadow-life">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-1.5 h-1.5 rounded-full bg-life-amber" />
        <span className="text-[11px] uppercase tracking-[0.16em] font-bold text-bca-ink/70">
          {tr.customFormTitle}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 mb-3">
        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-bca-ink/55 block mb-1">
            {tr.customNameLabel}
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder={tr.customNamePh}
            className="custom-field"
          />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-bca-ink/55 block mb-1">
            {tr.customChallengeLabel}
          </span>
          <select
            value={challenge}
            onChange={(e) => setChallenge(e.target.value)}
            className="custom-field"
          >
            <option value="Mudah">{tr.diffEasy}</option>
            <option value="Sedang">{tr.diffMedium}</option>
            <option value="Sulit">{tr.diffHard}</option>
          </select>
        </label>
      </div>

      <label className="block mb-3">
        <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-bca-ink/55 block mb-1">
          {tr.customBackgroundLabel}
        </span>
        <textarea
          value={background}
          onChange={(e) => setBackground(e.target.value)}
          rows={3}
          maxLength={600}
          placeholder={tr.customBackgroundPh}
          className="custom-field resize-none"
        />
      </label>

      <label className="block mb-1">
        <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-bca-ink/55 block mb-1">
          {tr.customNeedsLabel}
        </span>
        <textarea
          value={needs}
          onChange={(e) => setNeeds(e.target.value)}
          rows={3}
          maxLength={600}
          placeholder={tr.customNeedsPh}
          className="custom-field resize-none"
        />
      </label>

      <p className="text-[11.5px] text-bca-ink/50 mt-2 mb-4">{tr.customRequiredHint}</p>

      <button
        onClick={submit}
        disabled={!ready || starting}
        className="inline-flex items-center gap-2 bg-life-blue hover:brightness-110 text-white text-[13.5px] font-semibold rounded-full px-5 py-3 shadow-soft transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-life-amber" />
        {starting ? "…" : tr.customStart}
      </button>

      <style jsx>{`
        :global(.custom-field) {
          width: 100%;
          background: var(--life-surface);
          border: 1px solid var(--border-1);
          border-radius: 10px;
          padding: 0.5rem 0.7rem;
          font-size: 13.5px;
          color: var(--life-heading);
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        :global(.custom-field::placeholder) {
          color: var(--life-bodyLight);
        }
        :global(.custom-field:focus) {
          outline: none;
          border-color: var(--life-blue);
          box-shadow: 0 0 0 4px rgba(10, 85, 171, 0.16);
        }
      `}</style>
    </div>
  );
}

function EndingState({ tr }: { tr: any }) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center animate-fadeIn">
        <div className="flex justify-center mb-3">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full animate-blink mx-1"
            style={{ background: "#0a55ab" }}
          />
          <span
            className="inline-block w-2.5 h-2.5 rounded-full animate-blink mx-1"
            style={{ background: "#1582b3", animationDelay: "200ms" }}
          />
          <span
            className="inline-block w-2.5 h-2.5 rounded-full animate-blink mx-1"
            style={{ background: "#19b8a6", animationDelay: "400ms" }}
          />
        </div>
        <p className="font-sans font-extrabold text-life-heading text-[22px]">
          {tr.reportEyebrow}…
        </p>
      </div>
    </div>
  );
}

function TypingIndicator({ label }: { label: string }) {
  return (
    <div className="flex items-start gap-3 mb-4 animate-fadeIn">
      <div
        className="shrink-0 rounded-full flex items-center justify-center"
        style={{
          width: 38,
          height: 38,
          background:
            "radial-gradient(120% 120% at 30% 25%, #2E68C6 0%, #0F3C86 55%, #061B45 100%)",
        }}
      >
        <span className="text-[10px] font-bold text-life-amber">B</span>
      </div>
      <div className="bubble-bima inline-flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-life-blue animate-blink" />
          <span
            className="w-2 h-2 rounded-full bg-life-blue animate-blink"
            style={{ animationDelay: "200ms" }}
          />
          <span
            className="w-2 h-2 rounded-full bg-life-blue animate-blink"
            style={{ animationDelay: "400ms" }}
          />
        </span>
        <span className="text-[12.5px] italic text-bca-ink/65">{label}…</span>
      </div>
    </div>
  );
}

function MicIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}

function SpeakerIcon({ active }: { active?: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polygon points="3 10 7 10 12 5 12 19 7 14 3 14 3 10" />
      {active && (
        <>
          <path d="M16 8a5 5 0 0 1 0 8" />
          <path d="M19 5a9 9 0 0 1 0 14" />
        </>
      )}
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polygon points="3 10 7 10 12 5 12 19 7 14 3 14 3 10" />
      <path d="M16 8a5 5 0 0 1 0 8" />
    </svg>
  );
}

function MuteIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polygon points="3 10 7 10 12 5 12 19 7 14 3 14 3 10" />
      <line x1="18" y1="9" x2="22" y2="13" />
      <line x1="22" y1="9" x2="18" y2="13" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ transform: "translateX(1px)" }}
    >
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
    </svg>
  );
}

function VoicePicker({
  voices,
  lang,
  selectedName,
  autoLabel,
  pickerLabel,
  testLabel,
  sample: _sample,
  onSelect,
  onTest,
}: {
  voices: SpeechSynthesisVoice[];
  lang: string;
  selectedName: string | null;
  autoLabel: string;
  pickerLabel: string;
  testLabel: string;
  sample: string;
  onSelect: (name: string | null) => void;
  onTest: () => void;
}) {
  const family = lang.split("-")[0].toLowerCase();
  const inLang = voices.filter(
    (v) => v.lang === lang || v.lang.toLowerCase().startsWith(family),
  );
  const others = voices.filter((v) => !inLang.includes(v));

  const friendly = (v: SpeechSynthesisVoice) => {
    let n = v.name;
    n = n.replace(/Microsoft\s+/i, "").replace(/\s*Online\s*\(Natural\)/i, " · Natural");
    n = n.replace(/\s*\(Natural\)/i, " · Natural");
    return `${n} — ${v.lang}`;
  };

  return (
    <div className="inline-flex items-center gap-1.5">
      <label className="text-[10.5px] uppercase tracking-[0.14em] font-bold text-bca-ink/55">
        {pickerLabel}
      </label>
      <select
        value={selectedName ?? ""}
        onChange={(e) => onSelect(e.target.value || null)}
        className="text-[11px] font-medium px-2 py-1 rounded-full border border-life-blue/15 bg-white text-life-heading hover:border-life-blue/40 focus:outline-none focus:ring-1 focus:ring-life-blue max-w-[180px] truncate"
      >
        <option value="">{autoLabel}</option>
        {inLang.length > 0 && (
          <optgroup label={lang}>
            {inLang.map((v) => (
              <option key={v.name} value={v.name}>
                {friendly(v)}
              </option>
            ))}
          </optgroup>
        )}
        {others.length > 0 && (
          <optgroup label="Other">
            {others.map((v) => (
              <option key={v.name} value={v.name}>
                {friendly(v)}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      <button
        type="button"
        onClick={onTest}
        title={testLabel}
        className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-life-blue/15 bg-life-white/60 text-life-body hover:border-life-blue/50 hover:text-life-blue transition"
      >
        <PlayIcon />
      </button>
    </div>
  );
}
