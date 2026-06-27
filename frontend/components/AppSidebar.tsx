"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AccountMenu } from "@/components/AuthGate";
import { BimaAvatar } from "@/components/BimaAvatar";
import { prefetchPage } from "@/lib/swr";
import { type Lang } from "@/lib/i18n";

export type NavKey =
  | "home"
  | "progress"
  | "leaderboard"
  | "recommend"
  | "manager"
  | "admin";

const ICONS: Record<NavKey, ReactNode> = {
  home: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
    </svg>
  ),
  progress: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="4" y1="20" x2="4" y2="12" />
      <line x1="10" y1="20" x2="10" y2="6" />
      <line x1="16" y1="20" x2="16" y2="14" />
      <line x1="22" y1="20" x2="2" y2="20" />
    </svg>
  ),
  leaderboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
    </svg>
  ),
  recommend: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 18h6M10 22h4" />
      <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2h6c0-.8.4-1.5 1-2A7 7 0 0 0 12 2Z" />
    </svg>
  ),
  manager: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  ),
  admin: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  ),
};

// Short labels, one source of truth, same order on every page.
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
 * Global left navigation. Persistent collapsible column on md+, off-canvas
 * drawer on mobile (a slim top bar carries the hamburger). One component
 * across every cockpit page so navigation is identical everywhere.
 */
export function AppSidebar({
  lang,
  onLang,
  current,
}: {
  lang: Lang;
  onLang?: (l: Lang) => void;
  current: NavKey;
}) {
  const { signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const dests = destinations(lang);
  const signOutLabel = lang === "id" ? "Keluar" : "Sign out";

  // Restore collapsed preference after mount (avoids SSR/client mismatch).
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("bima.navCollapsed") === "1");
    } catch {}
  }, []);

  function toggleCollapse() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem("bima.navCollapsed", next ? "1" : "0");
      } catch {}
      return next;
    });
  }

  const navLinks = (compact: boolean, onClick?: () => void) =>
    dests.map((d) => {
      const active = d.key === current;
      return (
        <Link
          key={d.key}
          href={d.href}
          onClick={onClick}
          onMouseEnter={() => prefetchPage(d.key)}
          onFocus={() => prefetchPage(d.key)}
          aria-current={active ? "page" : undefined}
          title={compact ? d.label : undefined}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition ${
            compact ? "justify-center" : ""
          } ${
            active
              ? "bg-life-blue/[0.10] text-life-blue"
              : "text-life-body hover:text-life-blue hover:bg-life-blue/[0.05]"
          }`}
        >
          <span className="shrink-0 grid place-items-center w-[18px] h-[18px]">
            {ICONS[d.key]}
          </span>
          {!compact && <span className="truncate">{d.label}</span>}
        </Link>
      );
    });

  const langSwitch = (
    <div className="lang-switch shrink-0">
      {(["en", "id"] as const).map((l) => (
        <button
          key={l}
          onClick={() => onLang?.(l)}
          className={lang === l ? "is-on" : ""}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside
        className={`hidden md:flex flex-col shrink-0 sticky top-0 h-screen border-r border-life-blue/10 bg-life-white transition-[width] duration-200 ${
          collapsed ? "w-[66px]" : "w-[230px]"
        }`}
      >
        {/* Brand + collapse toggle */}
        <div className={`flex items-center gap-2.5 px-3 py-4 ${collapsed ? "justify-center" : ""}`}>
          <BimaAvatar size={collapsed ? 34 : 38} />
          {!collapsed && (
            <div className="leading-none min-w-0">
              <div className="text-life-heading font-extrabold tracking-tight text-[18px]">
                BIMA
              </div>
              <div className="text-[9px] uppercase tracking-[0.13em] text-life-body mt-1 truncate">
                Sales Companion
              </div>
            </div>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex-1 flex flex-col gap-1 px-2.5 overflow-y-auto scroll-stylish">
          {navLinks(collapsed)}
        </nav>

        {/* Footer: lang / theme / account */}
        <div className="border-t border-life-blue/10 px-2.5 py-3 flex flex-col gap-2.5">
          {!collapsed && onLang && <div className="flex justify-start">{langSwitch}</div>}
          <div className={`flex items-center gap-2 ${collapsed ? "flex-col" : ""}`}>
            <ThemeToggle />
            <button
              onClick={() => signOut()}
              title={signOutLabel}
              aria-label={signOutLabel}
              className={`inline-flex items-center gap-2 text-[12px] font-semibold text-life-body hover:text-life-blue rounded-full border border-life-blue/15 hover:border-life-blue/40 transition ${
                collapsed ? "w-9 h-9 justify-center" : "px-3 py-1.5"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              {!collapsed && signOutLabel}
            </button>
          </div>
          <button
            onClick={toggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`inline-flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.12em] font-semibold text-life-bodyLight hover:text-life-blue rounded-lg py-1.5 transition ${
              collapsed ? "" : "hover:bg-life-blue/[0.05]"
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ transform: collapsed ? "rotate(180deg)" : "none" }}>
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {!collapsed && (lang === "id" ? "Ciutkan" : "Collapse")}
          </button>
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <header className="md:hidden sticky top-0 z-40 flex items-center gap-3 px-4 py-3 border-b border-life-blue/10 bg-life-white">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Menu"
          className="flex items-center justify-center w-9 h-9 rounded-full border border-life-blue/15 text-life-body hover:text-life-blue hover:border-life-blue/40 transition"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <BimaAvatar size={32} />
        <span className="text-life-heading font-extrabold tracking-tight text-[17px]">
          BIMA
        </span>
        <div className="flex-1" />
        {onLang && langSwitch}
        <ThemeToggle />
        <AccountMenu />
      </header>

      {/* ── Mobile drawer ── */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-[270px] bg-life-white border-r border-life-blue/10 flex flex-col shadow-xl">
            <div className="flex items-center justify-between gap-2 px-4 py-4">
              <div className="flex items-center gap-2.5">
                <BimaAvatar size={36} />
                <span className="text-life-heading font-extrabold tracking-tight text-[18px]">
                  BIMA
                </span>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="flex items-center justify-center w-9 h-9 rounded-full text-life-body hover:text-life-blue transition"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 flex flex-col gap-1 px-3 overflow-y-auto scroll-stylish">
              {navLinks(false, () => setDrawerOpen(false))}
            </nav>
            <div className="border-t border-life-blue/10 px-3 py-3">
              <button
                onClick={() => {
                  setDrawerOpen(false);
                  signOut();
                }}
                className="inline-flex items-center gap-2 text-[13px] font-semibold text-life-body hover:text-life-blue rounded-full border border-life-blue/15 hover:border-life-blue/40 transition px-3 py-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                {signOutLabel}
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
