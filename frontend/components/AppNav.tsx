"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { type Lang } from "@/lib/i18n";

export type NavKey =
  | "home"
  | "progress"
  | "leaderboard"
  | "recommend"
  | "manager"
  | "admin";

// Short labels keep the top nav from overflowing once every destination is
// listed. One source of truth so every page shows the same set in the same
// order — no more hopping through "dashboard" to reach another page.
function destinations(lang: Lang): { key: NavKey; href: string; label: string }[] {
  const id = lang === "id";
  return [
    { key: "home", href: "/", label: id ? "Latihan" : "Train" },
    { key: "progress", href: "/progress", label: id ? "Progres" : "Progress" },
    { key: "leaderboard", href: "/leaderboard", label: id ? "Peringkat" : "Leaderboard" },
    { key: "recommend", href: "/recommend", label: id ? "Rekomendasi" : "Recommend" },
    { key: "manager", href: "/manager", label: "Dashboard" },
    { key: "admin", href: "/admin", label: "Admin" },
  ];
}

/**
 * Shared site navigation for the cream-themed pages (progress, leaderboard,
 * recommend, manager, admin). Renders the language switch, the full set of
 * destination links (inline on md+, hamburger on mobile), and sign out.
 */
export function AppNav({
  lang,
  onLang,
  current,
}: {
  lang: Lang;
  // Omit to hide the language switch (e.g. the English-only admin console).
  onLang?: (l: Lang) => void;
  current: NavKey;
}) {
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const dests = destinations(lang);
  const signOutLabel = lang === "id" ? "Keluar" : "Sign out";

  return (
    <div className="flex items-center gap-2.5">
      {/* Language switch */}
      {onLang && (
        <div
          className="inline-flex items-center rounded-full p-1 text-[11.5px] font-semibold shrink-0 bg-white border border-life-blue/15"
          style={{ letterSpacing: "0.08em" }}
        >
          {(["en", "id"] as const).map((l) => (
            <button
              key={l}
              onClick={() => onLang(l)}
              className={`px-3 py-1.5 rounded-full transition-all ${
                lang === l
                  ? "bg-life-blue text-white shadow-sm"
                  : "text-life-body hover:text-life-heading"
              }`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {/* Desktop links */}
      <nav className="hidden md:flex items-center gap-0.5">
        {dests.map((d) => {
          const active = d.key === current;
          return (
            <Link
              key={d.key}
              href={d.href}
              aria-current={active ? "page" : undefined}
              className={`text-[12px] smallcaps px-2.5 py-1 rounded-full transition ${
                active
                  ? "text-life-blue bg-life-blue/[0.08] font-semibold"
                  : "text-life-body hover:text-life-blue"
              }`}
            >
              {d.label}
            </Link>
          );
        })}
        <button
          onClick={() => signOut()}
          className="ml-1 inline-flex items-center gap-1.5 text-[12px] text-life-body hover:text-life-blue px-3 py-1.5 rounded-full border border-life-blue/15 bg-white hover:border-life-blue/40 transition"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          {signOutLabel}
        </button>
      </nav>

      {/* Mobile hamburger */}
      <div className="relative md:hidden shrink-0">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
          aria-expanded={open}
          className="flex items-center justify-center w-9 h-9 rounded-full border border-life-blue/15 bg-white text-life-body hover:text-life-blue hover:border-life-blue/40 transition"
        >
          {open ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-11 z-50 w-52 rounded-2xl border border-life-blue/12 bg-white shadow-lifeHover overflow-hidden py-1.5">
              {dests.map((d) => {
                const active = d.key === current;
                return (
                  <Link
                    key={d.key}
                    href={d.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`block px-4 py-2.5 text-[12.5px] smallcaps transition ${
                      active
                        ? "text-life-blue bg-life-blue/[0.07] font-semibold"
                        : "text-life-body hover:text-life-blue hover:bg-life-blueBg/60"
                    }`}
                  >
                    {d.label}
                  </Link>
                );
              })}
              <div className="h-px bg-life-blue/10 my-1" />
              <button
                onClick={() => {
                  setOpen(false);
                  signOut();
                }}
                className="w-full text-left px-4 py-2.5 text-[12.5px] smallcaps text-life-body hover:text-life-blue hover:bg-life-blueBg/60 transition"
              >
                {signOutLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
