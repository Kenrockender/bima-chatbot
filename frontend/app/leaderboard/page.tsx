"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BimaAvatar } from "@/components/BimaAvatar";
import { authedFetch } from "@/lib/api";
import { t, type Lang } from "@/lib/i18n";

type Title = { dimension: string; label: string; score: number };

type Entry = {
  rank: number;
  uid: string;
  name: string;
  picture: string;
  total_xp: number;
  level: number;
  total_sessions: number;
  title: Title | null;
  is_me: boolean;
};

type Board = { entries: Entry[]; me: Entry | null; total_players: number };

const MEDAL = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const [lang, setLang] = useState<Lang>("id");
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const tr = t[lang];

  useEffect(() => {
    authedFetch("/api/training/leaderboard")
      .then((r) => (r.ok ? r.json() : null))
      .then(setBoard)
      .finally(() => setLoading(false));
  }, []);

  const entries = board?.entries ?? [];
  const me = board?.me ?? null;
  const meRanked = me && entries.some((e) => e.is_me);

  return (
    <main className="min-h-screen bg-canvas relative overflow-hidden">
      <span className="watermark-b">B</span>

      <header className="relative z-10 border-b border-bca-rule/70 bg-bca-cream/70 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 pt-5 pb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <BimaAvatar size={44} />
              <div className="leading-tight">
                <div className="flex items-baseline gap-2">
                  <h1
                    className="font-serif text-bca-ink text-[26px] leading-none tracking-tight"
                    style={{ fontWeight: 500, letterSpacing: "-0.02em" }}
                  >
                    BIMA
                  </h1>
                  <span className="smallcaps text-bca-gold">{tr.navLeaderboard}</span>
                </div>
                <p className="text-[12.5px] text-bca-mute mt-1 tracking-wide">
                  BCA Life · Sales Arena
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="inline-flex items-center rounded-full p-1 text-[11.5px] font-semibold bg-bca-paper border border-bca-rule">
                {(["en", "id"] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={`px-3 py-1.5 rounded-full transition-all ${
                      lang === l
                        ? "bg-bca-navy text-bca-cream shadow-soft"
                        : "text-bca-mute hover:text-bca-ink"
                    }`}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
              <Link
                href="/"
                className="text-[12px] smallcaps text-bca-mute hover:text-bca-navy px-2 py-1 transition"
              >
                {tr.navTrain}
              </Link>
              <Link
                href="/progress"
                className="text-[12px] smallcaps text-bca-mute hover:text-bca-navy px-2 py-1 transition"
              >
                {tr.navProgress}
              </Link>
            </div>
          </div>
          <div className="gold-rule mt-4" />
        </div>
      </header>

      <div className="relative z-10 max-w-4xl mx-auto px-6 lg:px-8 py-10">
        <div className="animate-riseIn mb-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="block w-7 h-px bg-bca-gold" />
            <span className="smallcaps text-bca-gold">{tr.navLeaderboard}</span>
          </div>
          <h2
            className="font-serif text-bca-ink text-[30px] tracking-tight"
            style={{ fontWeight: 500, letterSpacing: "-0.02em" }}
          >
            {lang === "id" ? "Papan peringkat tim" : "Team leaderboard"}
          </h2>
          <p className="text-[13.5px] text-bca-mute mt-1">
            {lang === "id"
              ? "Diurutkan dari total XP. Selesaikan sesi latihan untuk naik peringkat."
              : "Ranked by total XP. Finish practice sessions to climb."}
          </p>
        </div>

        {loading ? (
          <div className="grid place-items-center py-20">
            <div className="h-7 w-7 rounded-full border-2 border-bca-gold border-t-transparent animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="surface-paper rounded-[18px] shadow-paper p-10 text-center text-bca-mute">
            {lang === "id"
              ? "Belum ada yang menyelesaikan sesi. Jadilah yang pertama!"
              : "No one has finished a session yet. Be the first!"}
          </div>
        ) : (
          <div className="space-y-2.5 animate-riseIn">
            {entries.map((e) => (
              <Row key={e.uid} e={e} lang={lang} />
            ))}

            {me && !meRanked && (
              <>
                <div className="text-center text-[11px] text-bca-mute py-1">···</div>
                <Row e={me} lang={lang} />
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function Row({ e, lang }: { e: Entry; lang: Lang }) {
  const top3 = e.rank <= 3;
  return (
    <div
      className={`flex items-center gap-4 rounded-[16px] px-4 py-3 border transition ${
        e.is_me
          ? "border-bca-gold bg-bca-cream shadow-card"
          : "border-bca-rule bg-bca-paper hover:shadow-soft"
      }`}
    >
      <div
        className={`w-9 text-center font-bold ${
          top3 ? "text-[20px]" : "text-[15px] text-bca-mute"
        }`}
      >
        {top3 ? MEDAL[e.rank - 1] : e.rank}
      </div>
      <div className="h-10 w-10 rounded-full overflow-hidden border border-bca-rule bg-bca-navy grid place-items-center shrink-0">
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
        <div className="text-[14.5px] font-semibold text-bca-ink truncate">
          {e.name}
          {e.is_me && (
            <span className="ml-2 text-[10.5px] uppercase tracking-wide text-bca-gold font-bold">
              {lang === "id" ? "Kamu" : "You"}
            </span>
          )}
        </div>
        <div className="text-[11.5px] text-bca-mute flex items-center gap-1.5 flex-wrap">
          <span>
            {lang === "id" ? "Level" : "Level"} {e.level} · {e.total_sessions}{" "}
            {lang === "id" ? "sesi" : "sessions"}
          </span>
          {e.title && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em] text-bca-gold"
              style={{ background: "#C8941E18" }}
              title={`${lang === "id" ? "Dimensi terkuat" : "Strongest skill"} · ${e.title.score}/10`}
            >
              ★ {e.title.label}
            </span>
          )}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[16px] font-bold text-bca-navy">{e.total_xp}</div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-bca-mute font-semibold">
          XP
        </div>
      </div>
    </div>
  );
}
