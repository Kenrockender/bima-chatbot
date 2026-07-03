"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary. Next renders this instead of a raw stack trace
 * when a client component throws during render. Kept dependency-free so it can
 * never itself fail to render.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface for debugging; a real deployment can wire this to logging.
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-life-page flex items-center justify-center px-6">
      <div className="life-card p-8 max-w-[440px] w-full text-center animate-fadeIn">
        <span
          className="inline-flex items-center justify-center rounded-2xl mx-auto mb-5"
          style={{ width: 56, height: 56, background: "var(--life-negBg)" }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--life-neg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </span>
        <h1 className="font-sans font-extrabold text-life-heading text-[22px] mb-2">
          Ada yang tidak beres
        </h1>
        <p className="text-[14px] text-life-body leading-relaxed mb-6">
          Terjadi kesalahan saat memuat halaman ini. Coba muat ulang — jika terus
          berlanjut, hubungi tim kami.
        </p>
        <button onClick={reset} className="btn-life mx-auto">
          <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-life-amber" />
          Coba lagi
        </button>
      </div>
    </div>
  );
}
