export type VoiceState = "idle" | "recording" | "processing" | "speaking";

export function MicButton({
  state,
  onClick,
  disabled,
}: {
  state: VoiceState;
  onClick: () => void;
  disabled?: boolean;
}) {
  const stateClass =
    state === "recording"
      ? "is-recording"
      : state === "processing"
        ? "is-processing"
        : state === "idle"
          ? "is-idle"
          : "";

  const ariaLabel =
    state === "recording" ? "Stop recording"
    : state === "processing" ? "Processing"
    : state === "speaking" ? "Tap to interrupt"
    : "Start recording";

  return (
    <button
      onClick={onClick}
      disabled={disabled || state === "processing"}
      aria-label={ariaLabel}
      className={`mic-large ${stateClass}`}
    >
      {state === "speaking" ? <SpeakerWaveIcon /> : <MicLargeIcon />}
    </button>
  );
}

function MicLargeIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
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

function SpeakerWaveIcon() {
  return (
    <svg
      width="30"
      height="30"
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
      <path d="M19 5a9 9 0 0 1 0 14" />
    </svg>
  );
}
