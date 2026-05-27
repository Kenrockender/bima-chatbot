"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChatBubble } from "@/components/ChatBubble";
import { EscalationCard } from "@/components/EscalationCard";
import { PersonaCard, type Persona } from "@/components/PersonaCard";
import { FeedbackReport, type Report } from "@/components/FeedbackReport";
import { useSTT, useTTS } from "@/hooks/useSpeech";
import { t, type Lang } from "@/lib/i18n";

type Message = {
  role: "user" | "assistant";
  content: string;
  facts?: { name?: string; page?: number | null }[];
  escalation?: boolean;
  timestamp?: Date;
};

type Stage = "pick" | "chat" | "report" | "ending";

export default function Home() {
  const [lang, setLang] = useState<Lang>("id");
  const [stage, setStage] = useState<Stage>("pick");
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activePersona, setActivePersona] = useState<Persona | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [muted, setMuted] = useState(false);
  const [listenStart, setListenStart] = useState<number | null>(null);
  const [listenSeconds, setListenSeconds] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tr = t[lang];

  const speechLang = lang === "id" ? "id-ID" : "en-US";
  const stt = useSTT({ lang: speechLang });
  const tts = useTTS({ lang: speechLang });

  useEffect(() => {
    if (stt.listening) setInput((stt.transcript + " " + stt.interim).trim());
  }, [stt.transcript, stt.interim, stt.listening]);

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

  useEffect(() => {
    fetch("/api/training/personas")
      .then((r) => r.json())
      .then(setPersonas)
      .catch(() => setPersonas([]));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy]);

  async function startSession(persona: Persona) {
    if (starting) return;
    setStarting(true);
    try {
      const res = await fetch("/api/training/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ persona_id: persona.id }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSessionId(data.session_id);
      setActivePersona(data.persona);
      setMessages([
        {
          role: "assistant",
          content: data.opening_message,
          timestamp: new Date(),
        },
      ]);
      setStage("chat");
      if (voiceMode && !muted && tts.supported) {
        setTimeout(() => tts.speak(data.opening_message), 250);
      }
    } catch {
      alert("Gagal memulai sesi. Coba lagi sebentar.");
    } finally {
      setStarting(false);
    }
  }

  async function send(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || busy || !sessionId) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text, timestamp: new Date() },
    ]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/training/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message: text }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
          facts: data.facts_referenced,
          timestamp: new Date(),
        },
      ]);
      if (voiceMode && !muted && tts.supported) tts.speak(data.reply);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            lang === "id"
              ? "Maaf, koneksi terputus. Jika masalah berlanjut, hubungi tim kami."
              : "Connection error. If this persists, reach out to our team.",
          escalation: true,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function endSession() {
    if (!sessionId) return;
    if (!confirm(tr.endSessionConfirm)) return;
    setStage("ending");
    try {
      const res = await fetch("/api/training/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setReport(data);
      setStage("report");
    } catch {
      alert("Gagal mengambil feedback. Coba lagi.");
      setStage("chat");
    }
  }

  function resetToPicker() {
    setStage("pick");
    setSelectedId(null);
    setActivePersona(null);
    setSessionId(null);
    setMessages([]);
    setReport(null);
    setInput("");
    if (stt.listening) stt.stop();
    if (tts.speaking) tts.cancel();
  }

  function toggleMic() {
    if (!stt.supported) return;
    if (stt.listening) {
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

  function onPickPersona(p: Persona) {
    setSelectedId(p.id);
    // If we're already in chat with a different persona, do not auto-switch — user must end first.
    if (stage === "pick") {
      // immediate start would be too aggressive; show a Start button in the welcome card
    }
  }

  const placeholder =
    voiceMode && stt.supported ? tr.tapToSpeak : tr.placeholder;

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
    <main className="min-h-screen bg-shell flex items-stretch justify-center px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
      <div className="bg-window w-full max-w-[1180px] flex flex-col overflow-hidden">
        {/* ─── HEADER ─── */}
        <header className="flex items-center gap-4 px-5 sm:px-8 py-4 border-b border-white/5">
          {/* BCA Life lockup */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center"
              style={{
                background:
                  "linear-gradient(160deg, #1F4684 0%, #0F3C86 60%, #061B45 100%)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
              aria-hidden
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 3c-2 4-5 5-9 6 4 1 7 2 9 6 2-4 5-5 9-6-4-1-7-2-9-6Z"
                  fill="#F5C518"
                />
              </svg>
            </div>
            <div className="leading-none">
              <div className="text-white font-bold tracking-tight text-[15px]">
                BCA<span className="text-bca-accentGold">life</span>
              </div>
              <div className="text-[9.5px] uppercase tracking-[0.18em] text-white/40 mt-0.5">
                Senantiasa melindungi anda
              </div>
            </div>
          </div>

          {/* BIMA wordmark */}
          <div className="hidden sm:flex items-baseline gap-3 ml-2 pl-4 border-l border-white/10">
            <span
              className="font-serif italic text-bca-accentGold"
              style={{
                fontSize: 30,
                lineHeight: 1,
                letterSpacing: "0.02em",
                textShadow: "0 2px 8px rgba(245,197,24,0.25)",
              }}
            >
              BIMA
            </span>
            <div className="leading-tight">
              <div className="text-white text-[13.5px] font-semibold">
                Persona Chat
              </div>
              <div className="text-[10px] text-white/45 tracking-wide">
                BCA Life Sales Companion
              </div>
            </div>
          </div>

          <div className="flex-1" />

          {/* Right side: end-session, links, language */}
          {stage === "chat" && activePersona && (
            <button
              onClick={endSession}
              className="hidden md:inline-flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-white/80 hover:text-white px-3 py-2 rounded-full border border-white/15 hover:border-bca-accentGold/60 transition"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-bca-accentGold" />
              {tr.endSession}
            </button>
          )}

          <Link
            href="/recommend"
            className="hidden md:inline text-[11px] uppercase tracking-[0.14em] font-semibold text-white/55 hover:text-bca-accentGold px-2 py-1 transition"
          >
            {tr.navRecommend}
          </Link>
          <Link
            href="/admin"
            className="hidden md:inline text-[11px] uppercase tracking-[0.14em] font-semibold text-white/55 hover:text-bca-accentGold px-2 py-1 transition"
          >
            {tr.admin}
          </Link>

          <div className="lang-switch">
            {(["en", "id"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={lang === l ? "is-on" : ""}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </header>

        {/* ─── BODY: sidebar + chat ─── */}
        <div className="flex-1 flex min-h-0">
          {/* Sidebar */}
          <aside className="hidden md:flex flex-col gap-3 w-[280px] shrink-0 px-4 py-5 border-r border-white/5 overflow-y-auto scroll-stylish">
            <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-white/40 px-1 mb-1">
              {tr.pickPersona}
            </div>
            {personas.map((p) => (
              <PersonaCard
                key={p.id}
                persona={p}
                selected={selectedId === p.id}
                active={activePersona?.id === p.id}
                onSelect={onPickPersona}
                challengeLabel={tr.challengeLabel}
              />
            ))}
            {personas.length === 0 && (
              <div className="text-white/40 text-[12px] px-1 py-3 italic">
                Loading personas…
              </div>
            )}
          </aside>

          {/* Main chat area */}
          <section className="flex-1 flex flex-col min-w-0 p-4 sm:p-5">
            <div className="flex-1 bg-chatpanel flex flex-col min-h-0 overflow-hidden">
              {/* Mobile persona strip */}
              <div className="md:hidden flex gap-2 overflow-x-auto px-3 py-3 border-b border-black/5">
                {personas.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onPickPersona(p)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold transition ${
                      (activePersona?.id ?? selectedId) === p.id
                        ? "bg-bca-shellMid text-white"
                        : "bg-white/70 text-bca-ink/70"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>

              {/* Scrolling messages or welcome / report */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto scroll-stylish px-4 sm:px-7 py-6"
              >
                {stage === "pick" && <Welcome
                  tr={tr}
                  selected={personas.find((x) => x.id === selectedId) ?? null}
                  starting={starting}
                  onStart={startSession}
                />}

                {stage === "ending" && <EndingState tr={tr} />}

                {stage === "report" && report && (
                  <FeedbackReport
                    report={report}
                    onTryAgain={resetToPicker}
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
                    }}
                  />
                )}

                {stage === "chat" && activePersona && (
                  <>
                    {messages.map((m, i) => (
                      <div key={i}>
                        <ChatBubble
                          role={m.role}
                          content={m.content}
                          sources={m.facts as any}
                          sourcesLabel={tr.factsTag}
                          youLabel="USER"
                          bimaLabel={activePersona.name.toUpperCase()}
                          timestamp={m.timestamp}
                        />
                        {m.escalation && (
                          <EscalationCard
                            whatsapp="+62 812-1234-5678"
                            email="hr-it@bcalife.co.id"
                            title={
                              lang === "id"
                                ? "Butuh bantuan langsung?"
                                : "Need direct help?"
                            }
                            body={
                              lang === "id"
                                ? "Tim kami siap membantu kamu melalui WhatsApp atau email."
                                : "Our team is ready to help via WhatsApp or email."
                            }
                            whatsappLabel="WhatsApp"
                            emailLabel="Email"
                          />
                        )}
                      </div>
                    ))}
                    {busy && <TypingIndicator label={tr.thinking} />}
                  </>
                )}
              </div>

              {/* Footer input bar */}
              {(stage === "chat" || stage === "pick") && (
                <div className="border-t border-black/5 px-3 sm:px-4 py-3 bg-white/30 backdrop-blur-sm">
                  {/* Voice error banner */}
                  {(sttErrorMessage || (voiceMode && !stt.supported)) && (
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
                        const next = !voiceMode;
                        setVoiceMode(next);
                        if (!next) {
                          if (stt.listening) stt.stop();
                          if (tts.speaking) tts.cancel();
                        }
                      }}
                      disabled={!stt.supported && !tts.supported}
                      title={
                        !stt.supported && !tts.supported
                          ? unsupportedMessage
                          : tr.voiceMode
                      }
                      className={`inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.14em] font-bold px-3 py-1.5 rounded-full border transition disabled:opacity-40 disabled:cursor-not-allowed ${
                        voiceMode
                          ? "bg-bca-shellMid text-bca-accentGold border-bca-accentGold/60 shadow-soft"
                          : "bg-white/60 text-bca-ink/60 border-bca-ink/15 hover:border-bca-shellMid/40"
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
                            ? "bg-white/60 text-bca-ink/55 border-bca-ink/15"
                            : "bg-bca-shellMid text-bca-accentGold border-bca-accentGold/60"
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
                          <span className="text-[11px] font-semibold text-bca-shellMid">
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
                          if (!stt.supported) {
                            // toggle voice mode as a hint
                            setVoiceMode((v) => !v);
                            return;
                          }
                          if (!voiceMode) setVoiceMode(true);
                          toggleMic();
                        }}
                        disabled={stage !== "chat" || busy}
                        title={stt.listening ? tr.listening : tr.tapToSpeak}
                        className={`btn-gold-circle shrink-0 ${stt.listening ? "ring-4 ring-red-500/40" : ""}`}
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
                      className="btn-gold-circle shrink-0"
                    >
                      <SendIcon />
                    </button>
                  </div>

                  {/* secondary row: persona quick-start / status */}
                  {stage === "pick" && selectedId && (
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
                        className="inline-flex items-center gap-2 bg-bca-shellMid hover:bg-bca-ink text-white text-[12.5px] font-semibold rounded-full px-4 py-2 shadow-soft transition disabled:opacity-60"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-bca-accentGold" />
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
    </main>
  );
}

// ─────────────────────────── helpers ───────────────────────────

function Welcome({
  tr,
  selected,
  starting,
  onStart,
}: {
  tr: (typeof t)["en"] | (typeof t)["id"];
  selected: Persona | null;
  starting: boolean;
  onStart: (p: Persona) => void;
}) {
  return (
    <div className="max-w-[640px] mx-auto py-6 animate-fadeIn">
      <div className="inline-flex items-center gap-2 mb-4">
        <span className="w-6 h-px bg-bca-accentGold" />
        <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-bca-accentGoldDeep">
          {tr.brandLine}
        </span>
      </div>
      <h2
        className="font-serif text-bca-ink text-[34px] sm:text-[40px] leading-[1.1] tracking-tight mb-4"
        style={{ fontWeight: 500, letterSpacing: "-0.02em" }}
      >
        {tr.landingHeadline}
      </h2>
      <p className="text-[15px] leading-[1.65] text-bca-ink/75 mb-6 max-w-[560px]">
        {tr.landingSubtitle}
      </p>

      <div className="bubble-bima max-w-[460px]">
        <p className="text-[13.5px] leading-[1.6]">
          {selected
            ? `${tr.pickPersona}: ${selected.name} · ${selected.title}. ${selected.summary}`
            : tr.pickPersonaHint}
        </p>
      </div>

      {selected && (
        <div className="mt-5">
          <button
            onClick={() => onStart(selected)}
            disabled={starting}
            className="inline-flex items-center gap-2 bg-bca-shellMid hover:bg-bca-ink text-white text-[13.5px] font-semibold rounded-full px-5 py-3 shadow-soft transition disabled:opacity-60"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-bca-accentGold" />
            {starting ? "…" : tr.startSession}
          </button>
        </div>
      )}
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
            style={{ background: "#F5C518" }}
          />
          <span
            className="inline-block w-2.5 h-2.5 rounded-full animate-blink mx-1"
            style={{ background: "#F5C518", animationDelay: "200ms" }}
          />
          <span
            className="inline-block w-2.5 h-2.5 rounded-full animate-blink mx-1"
            style={{ background: "#F5C518", animationDelay: "400ms" }}
          />
        </div>
        <p className="font-serif text-bca-ink text-[22px]">
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
        <span className="text-[10px] font-bold text-bca-accentGold">B</span>
      </div>
      <div className="bubble-bima inline-flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-bca-shellMid animate-blink" />
          <span
            className="w-2 h-2 rounded-full bg-bca-shellMid animate-blink"
            style={{ animationDelay: "200ms" }}
          />
          <span
            className="w-2 h-2 rounded-full bg-bca-shellMid animate-blink"
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
        className="text-[11px] font-medium px-2 py-1 rounded-full border border-bca-ink/15 bg-white/70 text-bca-ink hover:border-bca-shellMid/40 focus:outline-none focus:ring-1 focus:ring-bca-accentGold max-w-[180px] truncate"
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
        className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-bca-ink/15 bg-white/60 text-bca-ink/70 hover:border-bca-shellMid/50 hover:text-bca-shellMid transition"
      >
        <PlayIcon />
      </button>
    </div>
  );
}
