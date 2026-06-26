"use client";

import { useEffect } from "react";
import { AppSidebar, type NavKey } from "@/components/AppSidebar";
import { warmBackend } from "@/lib/swr";
import { type Lang } from "@/lib/i18n";

/**
 * Page shell: global left sidebar (collapsible on desktop, drawer on mobile)
 * plus the page content on the right. `fill` makes the content area exactly
 * viewport height (for the chat/training page); otherwise it scrolls naturally.
 */
export function AppShell({
  lang,
  onLang,
  current,
  fill,
  children,
}: {
  lang: Lang;
  onLang?: (l: Lang) => void;
  current: NavKey;
  fill?: boolean;
  children: React.ReactNode;
}) {
  // Wake the (sleep-prone) backend container as early as possible so the first
  // data fetch on any page doesn't block behind a cold start. Self-dedupes.
  useEffect(() => {
    warmBackend();
  }, []);

  return (
    <div className="min-h-screen md:flex bg-life">
      <AppSidebar lang={lang} onLang={onLang} current={current} />
      <main
        className={`flex-1 min-w-0 relative flex flex-col ${
          fill ? "md:h-screen min-h-screen overflow-hidden" : ""
        }`}
      >
        {children}
      </main>
    </div>
  );
}
