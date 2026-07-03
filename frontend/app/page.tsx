"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChatBubble } from "@/components/ChatBubble";
import { EscalationCard } from "@/components/EscalationCard";
import { PersonaCard, type Persona } from "@/components/PersonaCard";
import { FeedbackReport, type Report } from "@/components/FeedbackReport";
import { CoachChip, type Coach } from "@/components/CoachChip";
import { VoiceStage } from "@/components/VoiceStage";
import { AppShell } from "@/components/AppShell";
import { useConfirm } from "@/components/ConfirmModal";
import {
  CUSTOM_ID,
  CustomCta,
  DrillBriefing,
  EndingState,
  MicIcon,
  MuteIcon,
  PlayIcon,
  SendIcon,
  SpeakerIcon,
  TypingIndicator,
  VoicePicker,
  Welcome,
  type CustomConfig,
  type DrillBrief,
} from "@/components/home/HomeParts";
import { useSTT, useTTS } from "@/hooks/useSpeech";
import { useServerSTT } from "@/hooks/useServerSTT";
import { useServerTTS } from "@/hooks/useServerTTS";
import { authedFetch } from "@/lib/api";
import { clearCache } from "@/lib/swr";
import { recommendedPersona } from "@/lib/coaching";
import { t, type Lang } from "@/lib/i18n";

export type { CustomConfig, DrillBrief };

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
  const [activeDrill, setActiveDrill] = useState<DrillBrief | null>(null);
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
  const tr = t[lang];

  // The custom persona is rendered as a distinct CTA, not a regular card.
  // Memoized so we don't re-scan the list on every keystroke/stream tick.
  const customPersona = useMemo(
    () => personas.find((p) => p.id === CUSTOM_ID) ?? null,
    [personas],
  );
  const presetPersonas = useMemo(
    () => personas.filter((p) => p.id !== CUSTOM_ID),
    [personas],
  );

  const speechLang = lang === "id" ? "id-ID" : "en-US";
  const stt = useSTT({ lang: speechLang });
  const tts = useTTS({ lang: speechLang });
  const serverSTT = useServerSTT({ lang: speechLang });
  const serverTTS = useServerTTS();
  const hasVoice = stt.supported || serverSTT.available;

  // Prefer the natural ElevenLabs voice when the backend has it configured;
  // otherwise fall back to the browser's Web Speech voice.
  const useServerVoice = serverTTS.available;
  const ttsSupported = serverTTS.available || tts.supported;
  const voiceSpeaking = useServerVoice ? serverTTS.speaking : tts.speaking;
  const personaGender = activePersona?.gender || "f";

  function speakReply(text: string, gender?: string) {
    if (muted || !text) return;
    if (useServerVoice) serverTTS.speak(text, gender ?? personaGender);
    else if (tts.supported) tts.speak(text);
  }
  function cancelSpeak() {
    if (useServerVoice) serverTTS.cancel();
    else tts.cancel();
  }

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
    // A drill/persona deep-link should always start fresh — let that effect win
    // instead of restoring whatever stale session was in storage.
    const params = new URLSearchParams(window.location.search);
    if (params.get("drill") || params.get("persona")) return;
    try {
      const raw = sessionStorage.getItem("bima.session");
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.session_id && saved.persona) {
          setSessionId(saved.session_id);
          setActivePersona(saved.persona);
          setActiveDrill(saved.drill ?? null);
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
      setActiveDrill(data.drill ?? null);
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
          drill: data.drill ?? null,
          opening: data.opening_message,
          started: Date.now(),
        }));
      } catch {}
      setLastCoach(null);
      setLastFacts(null);
      if (inputMode === "voice") {
        setTimeout(() => speakReply(data.opening_message, data.persona.gender), 250);
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
    if (inputMode === "voice") speakReply(reply);
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
    setActiveDrill(null);
    setSessionId(null);
    setSessionStart(null);
    setMessages([]);
    setReport(null);
    setInput("");
    try { sessionStorage.removeItem("bima.session"); } catch {}
    abortRef.current?.abort();
    if (stt.listening || stt.paused) stt.stop();
    if (voiceSpeaking) cancelSpeak();
  }

  function toggleMic() {
    // Server STT fallback (iOS/Safari)
    if (!stt.supported && serverSTT.available) {
      if (serverSTT.recording) {
        serverSTT.stop();
      } else {
        if (voiceSpeaking) cancelSpeak();
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
      if (voiceSpeaking) cancelSpeak();
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
      : voiceSpeaking
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
              {activeDrill ? (
                <span className="shrink-0 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.1em] font-bold text-life-teal bg-life-teal/10 rounded-full px-2 py-0.5">
                  {tr.drillTag}: {activeDrill.title}
                </span>
              ) : (
                <span className="hidden sm:inline text-[11px] text-life-body shrink-0">
                  · {tr.challengeLabel}: {activePersona.challenge}
                </span>
              )}
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
                {/* Keyed by stage so each transition (pick→chat→report→ending)
                    re-triggers a gentle fade instead of snapping. */}
                <div key={stage} className="animate-fadeIn h-full">
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
                      copyReport: tr.copyReport,
                      downloadReport: tr.downloadReport,
                      reportCopied: tr.reportCopied,
                    }}
                  />
                )}

                {stage === "chat" && activePersona && activeDrill && (
                  <DrillBriefing drill={activeDrill} tr={tr} />
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
                    silenceProgress={0}
                    paused={stt.paused}
                    coach={lastCoach}
                    facts={null}
                    onMicClick={toggleMic}
                    onPauseToggle={pauseMic}
                    onRedo={redoMic}
                    onSwitchToText={() => {
                      setInputMode("text");
                      if (stt.listening || stt.paused) stt.stop();
                      if (voiceSpeaking) cancelSpeak();
                    }}
                    onMuteToggle={() => {
                      if (!muted && voiceSpeaking) cancelSpeak();
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
              </div>

              {/* Footer input bar — hidden in voice mode during chat */}
              {((stage === "chat" && !voiceMode) || stage === "pick") && (
                <div className="border-t border-life-blue/8 px-3 sm:px-4 py-3 bg-life-white/30 backdrop-blur-sm">
                  {/* Voice error banner */}
                  {(sttErrorMessage || (voiceMode && !stt.supported && !serverSTT.available)) && (
                    <div
                      role="alert"
                      className="mb-2 flex items-start gap-2 rounded-lg border border-life-neg/40 bg-life-negBg px-3 py-2 text-[12px] text-life-neg"
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
                          className="shrink-0 text-life-neg/80 hover:text-life-neg text-[11px] uppercase tracking-wide font-semibold"
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
                          if (voiceSpeaking) cancelSpeak();
                        }
                      }}
                      disabled={!hasVoice && !ttsSupported}
                      title={
                        !stt.supported && !ttsSupported
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

                    {voiceMode && ttsSupported && (
                      <button
                        onClick={() => {
                          if (!muted && voiceSpeaking) cancelSpeak();
                          setMuted((m) => !m);
                        }}
                        title={muted ? tr.unmute : tr.mute}
                        aria-label={muted ? tr.unmute : tr.mute}
                        aria-pressed={muted}
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-full border transition ${
                          muted
                            ? "bg-life-white/60 text-life-bodyLight border-life-blue/15"
                            : "bg-life-blue text-white border-life-blue"
                        }`}
                      >
                        {muted ? <MuteIcon /> : <PlayIcon />}
                      </button>
                    )}

                    {voiceMode && !useServerVoice && tts.supported && tts.voices.length > 0 && (
                      <VoicePicker
                        voices={tts.voices}
                        lang={speechLang}
                        selectedName={tts.voiceName}
                        autoLabel={tr.voiceAuto}
                        pickerLabel={tr.voicePicker}
                        testLabel={tr.voiceTest}
                        sample={tr.voiceTestSample}
                        onSelect={(name) => {
                          if (voiceSpeaking) cancelSpeak();
                          tts.setVoice(name);
                        }}
                        onTest={() => {
                          if (voiceSpeaking) cancelSpeak();
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
                      ) : voiceSpeaking ? (
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
                        aria-label={stt.listening || serverSTT.recording ? tr.listening : tr.tapToSpeak}
                        aria-pressed={stt.listening || serverSTT.recording}
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
