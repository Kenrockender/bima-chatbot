"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { FetchError } from "@/components/FetchError";
import { TrophyIcon } from "@/components/icons";
import { useAuth } from "@/components/AuthProvider";
import { authedFetch } from "@/lib/api";
import { readCache, writeCache } from "@/lib/swr";
import { t, type Lang } from "@/lib/i18n";

type Title = { dimension: string; label: string; score: number };

type Entry = {
  rank: number;
  uid: string;
  name: string;
  picture: string;
  avg_score: number;
  total_sessions: number;
  title: Title | null;
  is_me: boolean;
};

type Board = { entries: Entry[]; me: Entry | null; total_players: number };

const MEDAL = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const { user, loading: authLoading, enabled } = useAuth();
  const [lang, setLang] = useState<Lang>("id");
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const tr = t[lang];

  // `bg` = background revalidation over already-painted cached data.
  function loadBoard(bg = false) {
    if (!bg) setLoading(true);
    setFetchError(false);
    authedFetch("/api/training/leaderboard")
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d: Board) => { setBoard(d); writeCache("leaderboard", d); })
      .catch(() => { if (!bg) setFetchError(true); })
      .finally(() => setLoading(false));
  }

  // Wait for Firebase to resolve the session before fetching. Fetching while
  // `auth.currentUser` is still null sends no bearer token, the backend 401s,
  // and the page would flash a misleading error. Once auth is ready (a user is
  // signed in, or Firebase is disabled for local dev) we load.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (authLoading) return;        // still restoring the session
    if (enabled && !user) return;   // signed out — AuthGate shows sign-in
    const cached = readCache<Board>("leaderboard");
    if (cached) {
      setBoard(cached);
      setLoading(false);
      loadBoard(true); // revalidate silently
    } else {
      loadBoard();
    }
  }, [authLoading, user, enabled]);

  const entries = board?.entries ?? [];
  const me = board?.me ?? null;
  const meRanked = me && entries.some((e) => e.is_me);

  return (
    <AppShell lang={lang} onLang={setLang} current="leaderboard">

      {/* Hero band — blue→teal gradient with the title */}
      <section className="life-gradient relative overflow-hidden">
        <div
          aria-hidden
          className="absolute rounded-full"
          style={{
            width: 420, height: 420, right: -120, top: -160,
            background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.16), rgba(255,255,255,0))",
          }}
        />
        <div
          aria-hidden
          className="absolute rounded-full"
          style={{
            width: 280, height: 280, left: -90, bottom: -150,
            background: "radial-gradient(circle at 50% 50%, rgba(25,184,166,0.35), rgba(25,184,166,0))",
          }}
        />
        <div className="relative z-10 max-w-3xl mx-auto px-6 lg:px-8 pt-9 pb-14 animate-riseIn">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-white/90" />
            <span className="h-1 w-10 rounded-full bg-white/70" />
            <span className="ml-1 text-[11.5px] font-bold uppercase tracking-[0.13em] text-white/85">
              {tr.navLeaderboard}
            </span>
          </div>
          <h2
            className="font-sans font-extrabold text-white text-[30px] sm:text-[38px] leading-[1.08] tracking-tight"
            style={{ letterSpacing: "-0.025em" }}
          >
            {lang === "id" ? "Papan peringkat tim" : "Team leaderboard"}
          </h2>
          <p className="text-[14.5px] leading-[1.6] text-white/80 mt-2.5 max-w-[560px]">
            {lang === "id"
              ? "Diurutkan dari skor rata-rata. Jaga kualitas tiap sesi untuk naik peringkat."
              : "Ranked by average score. Keep your quality high to climb."}
          </p>
        </div>
      </section>

      <div className="relative z-10 max-w-3xl mx-auto px-6 lg:px-8 py-9 -mt-7">
        {loading ? (
          <div className="life-card overflow-hidden animate-fadeIn">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-life-blue/8 last:border-0">
                <div className="skeleton w-7 h-7 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <div className="skeleton h-4 w-32" />
                  <div className="skeleton h-3 w-20" />
                </div>
                <div className="skeleton h-5 w-16" />
              </div>
            ))}
          </div>
        ) : fetchError ? (
          <FetchError message={tr.fetchError} onRetry={loadBoard} />
        ) : entries.length === 0 ? (
          <div className="life-card p-10 text-center flex flex-col items-center gap-4 animate-fadeIn">
            <span className="life-icon" style={{ width: 56, height: 56, borderRadius: 18 }}>
              <TrophyIcon size={28} className="text-white" />
            </span>
            <p className="text-life-body text-[15px] max-w-[360px]">{tr.leaderboardEmpty}</p>
            <Link href="/" className="btn-life">
              <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-life-amber" />
              {tr.leaderboardEmptyCta}
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5 animate-riseIn">
            {entries.map((e) => (
              <Row key={e.uid} e={e} lang={lang} />
            ))}

            {me && !meRanked && (
              <>
                <div className="text-center text-[11px] text-life-bodyLight py-1">···</div>
                <Row e={me} lang={lang} />
              </>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Row({ e, lang }: { e: Entry; lang: Lang }) {
  const top3 = e.rank <= 3;
  return (
    <div
      className={`flex items-center gap-4 rounded-[16px] px-4 py-3 border transition ${
        e.is_me
          ? "border-life-amber bg-life-amberBg shadow-lifeBlue"
          : "border-life-blue/12 bg-white hover:shadow-life"
      }`}
    >
      <div
        className={`w-9 text-center font-bold ${
          top3 ? "text-[20px]" : "text-[15px] text-life-bodyLight"
        }`}
      >
        {top3 ? MEDAL[e.rank - 1] : e.rank}
      </div>
      <div className="h-10 w-10 rounded-full overflow-hidden grid place-items-center shrink-0 life-icon">
        {e.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.picture} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-white text-[15px] font-bold">
            {(e.name || "?").charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] font-semibold text-life-heading truncate">
          {e.name}
          {e.is_me && (
            <span className="ml-2 text-[10.5px] uppercase tracking-wide text-life-blue font-bold">
              {lang === "id" ? "Kamu" : "You"}
            </span>
          )}
        </div>
        <div className="text-[11.5px] text-life-body flex items-center gap-1.5 flex-wrap">
          <span>
            {e.total_sessions} {lang === "id" ? "sesi" : "sessions"}
          </span>
          {e.title && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em] text-life-amberDark bg-life-amber/15"
              title={`${lang === "id" ? "Dimensi terkuat" : "Strongest skill"} · ${e.title.score}/10`}
            >
              ★ {e.title.label}
            </span>
          )}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[16px] font-bold text-life-blue tabular-nums">
          {(e.avg_score ?? 0).toFixed(1)}
        </div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-life-bodyLight font-semibold">
          {lang === "id" ? "Rata-rata" : "Avg"}
        </div>
      </div>
    </div>
  );
}
