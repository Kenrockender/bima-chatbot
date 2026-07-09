"use client";

import { useEffect, useState } from "react";

type ThemePref = "light" | "dark" | "system";

function resolveSystem(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(pref: ThemePref) {
  const effective = pref === "system" ? resolveSystem() : pref;
  document.documentElement.classList.toggle("dark", effective === "dark");
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [pref, setPref] = useState<ThemePref>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sera-theme") as ThemePref | null;
      setPref(saved === "light" || saved === "dark" ? saved : "system");
    } catch {}
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mounted, pref]);

  function cycle() {
    const order: ThemePref[] = ["light", "dark", "system"];
    const next = order[(order.indexOf(pref) + 1) % order.length];
    setPref(next);
    applyTheme(next);
    try {
      localStorage.setItem("sera-theme", next);
    } catch {}
  }

  const effective = pref === "system" ? resolveSystem() : pref;
  const isDark = effective === "dark";

  const label = pref === "system"
    ? "System theme"
    : isDark ? "Switch to system" : "Switch to dark mode";

  return (
    <button
      onClick={cycle}
      type="button"
      aria-label={label}
      title={label}
      className={`flex items-center justify-center w-9 h-9 rounded-full border border-life-blue/15 bg-life-white text-life-body hover:text-life-blue hover:border-life-blue/40 transition shrink-0 ${className}`}
    >
      {!mounted ? (
        <SunIcon />
      ) : pref === "system" ? (
        <AutoIcon />
      ) : isDark ? (
        <SunIcon />
      ) : (
        <MoonIcon />
      )}
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

/**
 * "Auto / follow system" glyph — a circle whose left half is filled. Reads as
 * an automatic light/dark contrast switch on any device, unlike the old desktop
 * monitor icon which looked out of place on mobile.
 */
function AutoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor" stroke="none" />
    </svg>
  );
}
