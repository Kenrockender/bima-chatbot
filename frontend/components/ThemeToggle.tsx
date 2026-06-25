"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

/**
 * Light/dark switch. The actual class is applied pre-paint by the inline
 * script in app/layout.tsx (no flash); this component only reflects and
 * mutates that state, persisting the choice to localStorage.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  // Read the theme the inline script already resolved.
  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    setMounted(true);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("bima-theme", next);
    } catch {
      /* private mode / storage disabled — choice just won't persist */
    }
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={toggle}
      type="button"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className={`flex items-center justify-center w-9 h-9 rounded-full border border-life-blue/15 bg-white text-life-body hover:text-life-blue hover:border-life-blue/40 transition shrink-0 ${className}`}
    >
      {/* Render a stable icon until mounted to keep SSR/CSR markup aligned */}
      {!mounted || isDark ? (
        // Sun — shown in dark mode (click → go light)
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        // Moon — shown in light mode (click → go dark)
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
