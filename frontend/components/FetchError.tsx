"use client";

/**
 * Inline error banner with retry button. Drop-in replacement for the silent
 * "loading forever" state that occurs when a backend fetch fails.
 */
export function FetchError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="life-card p-6 text-center max-w-[460px] mx-auto animate-fadeIn"
    >
      <div className="flex justify-center mb-3">
        <span className="life-icon grid place-items-center" style={{ width: 40, height: 40, background: "linear-gradient(150deg, var(--life-neg), #c0392b)" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </span>
      </div>
      <p className="text-[14px] text-life-heading font-semibold mb-1">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 inline-flex items-center gap-2 btn-life text-[13px]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Coba lagi
        </button>
      )}
    </div>
  );
}
