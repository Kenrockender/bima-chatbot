import { useEffect, useState } from "react";
import { BimaAvatar } from "./BimaAvatar";
import { CoachChip, type Coach } from "./CoachChip";
import { MicButton, type VoiceState } from "./MicButton";
import { SubtitleDisplay } from "./SubtitleDisplay";

type Fact = { name?: string; page?: number | null };

export function VoiceStage({
  voiceState,
  personaName,
  personaDifficulty,
  aiSubtitle,
  userCaption,
  userInterim,
  silenceProgress,
  coach,
  facts,
  onMicClick,
  onSwitchToText,
  onMuteToggle,
  onEndSession,
  muted,
  sttError,
  sttErrorMessage,
  labels,
}: {
  voiceState: VoiceState;
  personaName: string;
  personaDifficulty: string;
  aiSubtitle: string;
  userCaption: string;
  userInterim: boolean;
  silenceProgress: number;
  coach: Coach | null;
  facts: Fact[] | null;
  onMicClick: () => void;
  onSwitchToText: () => void;
  onMuteToggle: () => void;
  onEndSession: () => void;
  muted: boolean;
  sttError: string | null;
  sttErrorMessage: string | null;
  labels: {
    switchToText: string;
    readyToListen: string;
    recording: string;
    processingVoice: string;
    aiSpeaking: string;
    tapToInterrupt: string;
    mute: string;
    unmute: string;
    endSession: string;
    coachLabel: string;
    factsTag: string;
    voiceErrDismiss: string;
  };
}) {
  const [showCoach, setShowCoach] = useState(false);
  const [showFacts, setShowFacts] = useState(false);

  useEffect(() => {
    if (coach) {
      setShowCoach(true);
      const timer = setTimeout(() => setShowCoach(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [coach]);

  useEffect(() => {
    if (facts && facts.length > 0) {
      setShowFacts(true);
      const timer = setTimeout(() => setShowFacts(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [facts]);

  const statusText =
    voiceState === "recording"
      ? labels.recording
      : voiceState === "processing"
        ? labels.processingVoice
        : voiceState === "speaking"
          ? labels.tapToInterrupt
          : labels.readyToListen;

  const subtitleContent = (() => {
    if (voiceState === "recording" && userCaption) {
      return <SubtitleDisplay text={userCaption} variant="user" interim={userInterim} />;
    }
    if (voiceState === "processing") {
      return <SubtitleDisplay text={labels.processingVoice} variant="status" />;
    }
    if (aiSubtitle) {
      return <SubtitleDisplay text={aiSubtitle} variant="ai" />;
    }
    return <SubtitleDisplay text={statusText} variant="status" />;
  })();

  return (
    <div className="voice-stage">
      {/* Persona indicator pill */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/50 border border-black/5">
        <span className="w-1.5 h-1.5 rounded-full bg-bca-accentGold" />
        <span className="text-[11px] font-semibold text-bca-ink/70">{personaName}</span>
        <span className="text-[10px] text-bca-ink/40">·</span>
        <span className="text-[10px] text-bca-ink/45">{personaDifficulty}</span>
      </div>

      {/* Avatar */}
      <BimaAvatar size={120} withPulse={voiceState === "speaking"} />

      {/* Subtitle area */}
      {subtitleContent}

      {/* Error display */}
      {sttErrorMessage && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50/90 border border-red-300/60 text-[12px] text-red-800 max-w-[400px]">
          <span className="flex-1">{sttErrorMessage}</span>
          <button
            onClick={onMicClick}
            className="text-[11px] uppercase tracking-wide font-semibold text-red-700/70 hover:text-red-900"
          >
            {labels.voiceErrDismiss}
          </button>
        </div>
      )}

      {/* Coach chip overlay */}
      {showCoach && coach && (
        <div className="max-w-[400px] w-full animate-fadeIn">
          <CoachChip coach={coach} label={labels.coachLabel} />
        </div>
      )}

      {/* Facts pill */}
      {showFacts && facts && facts.length > 0 && (
        <div className="animate-fadeIn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-bca-cream border border-bca-rule text-[11px] text-bca-ink/65">
          <span className="font-semibold text-bca-gold text-[10px] uppercase tracking-[0.1em]">
            {labels.factsTag}
          </span>
          {facts.map((f, i) => (
            <span key={i}>
              {f.name}
              {f.page != null && ` (hal. ${f.page})`}
              {i < facts.length - 1 && ", "}
            </span>
          ))}
        </div>
      )}

      {/* Silence countdown bar */}
      {voiceState === "recording" && silenceProgress > 0 && (
        <div className="w-32 h-1 rounded-full bg-black/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-none"
            style={{
              width: `${silenceProgress * 100}%`,
              background: silenceProgress > 0.7 ? "#e53e3e" : "#d69e2e",
            }}
          />
        </div>
      )}

      {/* Mic button */}
      <MicButton state={voiceState} onClick={onMicClick} />

      {/* Secondary controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={onSwitchToText}
          className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.12em] font-bold text-bca-ink/50 hover:text-bca-ink/80 px-3 py-1.5 rounded-full border border-black/10 hover:border-black/20 transition"
        >
          <KeyboardIcon />
          {labels.switchToText}
        </button>

        <button
          onClick={onMuteToggle}
          title={muted ? labels.unmute : labels.mute}
          className={`inline-flex items-center justify-center w-8 h-8 rounded-full border transition ${
            muted
              ? "bg-white/60 text-bca-ink/55 border-black/10"
              : "bg-bca-shellMid text-bca-accentGold border-bca-accentGold/60"
          }`}
        >
          {muted ? <MuteSmIcon /> : <SpeakerSmIcon />}
        </button>

        <button
          onClick={onEndSession}
          className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.12em] font-bold text-red-600/70 hover:text-red-700 px-3 py-1.5 rounded-full border border-red-300/40 hover:border-red-400/60 transition"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          {labels.endSession}
        </button>
      </div>
    </div>
  );
}

function KeyboardIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <line x1="6" y1="8" x2="6" y2="8" />
      <line x1="10" y1="8" x2="10" y2="8" />
      <line x1="14" y1="8" x2="14" y2="8" />
      <line x1="18" y1="8" x2="18" y2="8" />
      <line x1="6" y1="12" x2="6" y2="12" />
      <line x1="10" y1="12" x2="10" y2="12" />
      <line x1="14" y1="12" x2="14" y2="12" />
      <line x1="18" y1="12" x2="18" y2="12" />
      <line x1="8" y1="16" x2="16" y2="16" />
    </svg>
  );
}

function SpeakerSmIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="3 10 7 10 12 5 12 19 7 14 3 14 3 10" />
      <path d="M16 8a5 5 0 0 1 0 8" />
    </svg>
  );
}

function MuteSmIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="3 10 7 10 12 5 12 19 7 14 3 14 3 10" />
      <line x1="18" y1="9" x2="22" y2="13" />
      <line x1="22" y1="9" x2="18" y2="13" />
    </svg>
  );
}
