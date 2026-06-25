import { useEffect, useState } from "react";
import { AudioWaveform } from "./AudioWaveform";
import { BimaAvatar } from "./BimaAvatar";
import { CoachChip, type Coach } from "./CoachChip";
import { MicButton, type VoiceState } from "./MicButton";
import { SubtitleDisplay } from "./SubtitleDisplay";

type Fact = { name?: string; page?: number | null };

export function VoiceStage({
  voiceState,
  personaName,
  personaDifficulty,
  sessionTimer,
  aiSubtitle,
  userCaption,
  userInterim,
  silenceProgress,
  paused,
  coach,
  facts,
  onMicClick,
  onPauseToggle,
  onRedo,
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
  sessionTimer: string | null;
  aiSubtitle: string;
  userCaption: string;
  userInterim: boolean;
  silenceProgress: number;
  paused: boolean;
  coach: Coach | null;
  facts: Fact[] | null;
  onMicClick: () => void;
  onPauseToggle: () => void;
  onRedo: () => void;
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
    pauseRec: string;
    resumeRec: string;
    redoRec: string;
    pausedStatus: string;
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
      ? paused
        ? labels.pausedStatus
        : labels.recording
      : voiceState === "processing"
        ? labels.processingVoice
        : voiceState === "speaking"
          ? labels.tapToInterrupt
          : labels.readyToListen;

  const subtitleContent = (() => {
    if (voiceState === "recording" && userCaption) {
      return <SubtitleDisplay text={userCaption} variant="user" interim={userInterim && !paused} />;
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
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-life-blue/12 shadow-life">
        <span className="w-1.5 h-1.5 rounded-full bg-life-amber" />
        <span className="text-[11px] font-semibold text-life-heading">{personaName}</span>
        <span className="text-[10px] text-life-bodyLight">·</span>
        <span className="text-[10px] text-life-body">{personaDifficulty}</span>
        {sessionTimer && (
          <>
            <span className="text-[10px] text-life-bodyLight">·</span>
            <span className="text-[10px] font-mono text-life-body tabular-nums">{sessionTimer}</span>
          </>
        )}
      </div>

      {/* Avatar */}
      <BimaAvatar size={120} withPulse={voiceState === "speaking"} />

      {/* Subtitle area */}
      {subtitleContent}

      {/* Audio waveform */}
      {voiceState === "recording" && <AudioWaveform active={!paused} />}

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
        <div className="animate-fadeIn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-life-blueBg border border-life-blue/12 text-[11px] text-life-body">
          <span className="font-semibold text-life-amberDark text-[10px] uppercase tracking-[0.1em]">
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

      {/* Recording controls: pause/resume + redo */}
      {voiceState === "recording" && (
        <div className="flex items-center gap-2 -mt-1">
          <button
            onClick={onPauseToggle}
            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full border transition ${
              paused
                ? "bg-life-blue text-white border-life-blue"
                : "bg-white text-life-body border-life-blue/15 hover:border-life-blue/40"
            }`}
          >
            {paused ? <PlayIcon /> : <PauseIcon />}
            {paused ? labels.resumeRec : labels.pauseRec}
          </button>
          <button
            onClick={onRedo}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full border bg-white text-life-body border-life-blue/15 hover:border-life-blue/40 transition"
          >
            <RedoIcon />
            {labels.redoRec}
          </button>
        </div>
      )}

      {/* Secondary controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={onSwitchToText}
          className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.12em] font-bold text-life-body hover:text-life-heading px-3 py-1.5 rounded-full border border-life-blue/15 hover:border-life-blue/40 transition"
        >
          <KeyboardIcon />
          {labels.switchToText}
        </button>

        <button
          onClick={onMuteToggle}
          title={muted ? labels.unmute : labels.mute}
          className={`inline-flex items-center justify-center w-8 h-8 rounded-full border transition ${
            muted
              ? "bg-white text-life-bodyLight border-life-blue/15"
              : "bg-life-blue text-white border-life-blue"
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

function PauseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <polygon points="6 4 20 12 6 20 6 4" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
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
