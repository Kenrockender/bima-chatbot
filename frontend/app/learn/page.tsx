"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { FetchError } from "@/components/FetchError";
import { authedFetch } from "@/lib/api";
import { readCache, writeCache } from "@/lib/swr";
import { t, type Lang } from "@/lib/i18n";

type Gate = { dimension: string; min_score: number; overall_min: number | null };

type Module = {
  id: string;
  stage: string;
  order: number;
  title: string;
  dimension: string;
  persona_id: string;
  summary: string;
  objective: string;
  gate: Gate;
  attempts: number;
  best_score: number;
  passed: boolean;
  unlocked: boolean;
};

type Curriculum = {
  modules: Module[];
  total_modules: number;
  passed_modules: number;
  percent_complete: number;
  completed: boolean;
  next_module_id: string | null;
};

// Bilingual copy kept local to this page — the rest of the app leans on i18n
// for shared strings, but the curriculum has enough page-specific text that a
// small local dictionary reads cleaner than growing the global one.
const COPY = {
  id: {
    eyebrow: "Jalur Belajar",
    title: "Kelas BIMA",
    subtitle:
      "Kuasai siklus penjualan langkah demi langkah. Setiap modul terbuka setelah kamu lulus modul sebelumnya.",
    progressLabel: "Modul dikuasai",
    ofWord: "dari",
    start: "Mulai modul",
    retry: "Ulangi",
    next: "Lanjut di sini",
    locked: "Terkunci",
    lockedHint: "Lulus modul sebelumnya untuk membuka.",
    passed: "Dikuasai",
    gateLabel: "Syarat lulus",
    bestLabel: "Skor terbaik",
    attemptsLabel: "Percobaan",
    focusLabel: "Fokus",
    overallSuffix: "& skor total",
    doneTitle: "Kurikulum tuntas! 🎉",
    doneBody:
      "Kamu sudah menguasai seluruh siklus penjualan. Ulangi modul mana pun untuk menjaga ketajaman.",
    loadError: "Gagal memuat kurikulum.",
  },
  en: {
    eyebrow: "Learning Path",
    title: "BIMA Academy",
    subtitle:
      "Master the sales cycle step by step. Each module unlocks after you pass the one before it.",
    progressLabel: "Modules mastered",
    ofWord: "of",
    start: "Start module",
    retry: "Replay",
    next: "Continue here",
    locked: "Locked",
    lockedHint: "Pass the previous module to unlock.",
    passed: "Mastered",
    gateLabel: "Passing bar",
    bestLabel: "Best score",
    attemptsLabel: "Attempts",
    focusLabel: "Focus",
    overallSuffix: "& overall score",
    doneTitle: "Curriculum complete! 🎉",
    doneBody:
      "You've mastered the full sales cycle. Replay any module to keep your edge sharp.",
    loadError: "Failed to load curriculum.",
  },
} as const;

export default function LearnPage() {
  const [lang, setLang] = useState<Lang>("id");
  const [data, setData] = useState<Curriculum | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const tr = t[lang];
  const c = COPY[lang];

  const dimLabel = (d: string) => (tr as Record<string, string>)[d] ?? d;

  function load(bg = false) {
    if (!bg) setLoading(true);
    setFetchError(false);
    authedFetch("/api/training/curriculum")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Curriculum | null) => {
        if (!d) {
          if (!bg) setFetchError(true);
          return;
        }
        setData(d);
        writeCache("curriculum", d);
      })
      .catch(() => {
        if (!bg) setFetchError(true);
      })
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const cached = readCache<Curriculum>("curriculum");
    if (cached) {
      setData(cached);
      setLoading(false);
      load(true); // revalidate silently
    } else {
      load();
    }
  }, []);

  // Group modules into their stages, preserving order.
  const stages = useMemo(() => {
    if (!data) return [];
    const out: { stage: string; modules: Module[] }[] = [];
    for (const m of data.modules) {
      const last = out[out.length - 1];
      if (last && last.stage === m.stage) last.modules.push(m);
      else out.push({ stage: m.stage, modules: [m] });
    }
    return out;
  }, [data]);

  return (
    <AppShell lang={lang} onLang={setLang} current="learn">
      {/* Hero band */}
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
        <div className="relative z-10 max-w-5xl mx-auto px-6 lg:px-8 pt-9 pb-14 animate-riseIn">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-white/90" />
            <span className="h-1 w-10 rounded-full bg-white/70" />
            <span className="ml-1 text-[11.5px] font-bold uppercase tracking-[0.13em] text-white/85">
              {c.eyebrow}
            </span>
          </div>
          <h2
            className="font-sans font-extrabold text-white text-[30px] sm:text-[40px] leading-[1.08] tracking-tight"
            style={{ letterSpacing: "-0.025em" }}
          >
            {c.title}
          </h2>
          <p className="text-[14.5px] leading-[1.6] text-white/80 mt-2.5 max-w-[620px]">
            {c.subtitle}
          </p>

          {data && (
            <div className="mt-8 max-w-[520px]">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-[11.5px] font-bold uppercase tracking-[0.13em] text-white/85">
                  {c.progressLabel}
                </span>
                <span className="text-[13px] font-semibold text-white/90">
                  {data.passed_modules} {c.ofWord} {data.total_modules}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-white/20 overflow-hidden">
                <div
                  className="h-full rounded-full bg-life-amber transition-[width] duration-500"
                  style={{ width: `${data.percent_complete}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="relative z-10 max-w-5xl mx-auto px-6 lg:px-8 py-9 -mt-7 w-full">
        {loading ? (
          <div className="space-y-4 animate-fadeIn">
            {[0, 1, 2].map((i) => (
              <div key={i} className="life-card p-5">
                <div className="skeleton h-4 w-32 rounded mb-3" />
                <div className="skeleton h-3 w-full rounded mb-2" />
                <div className="skeleton h-3 w-2/3 rounded" />
              </div>
            ))}
          </div>
        ) : fetchError ? (
          <FetchError message={c.loadError} onRetry={() => load()} />
        ) : (
          <div className="space-y-8 animate-fadeIn">
            {data?.completed && (
              <div className="life-card p-5 border border-life-teal/30 bg-life-blueBg/50">
                <p className="font-sans font-extrabold text-life-heading text-[17px]">
                  {c.doneTitle}
                </p>
                <p className="text-[13.5px] text-life-body mt-1.5 leading-relaxed">
                  {c.doneBody}
                </p>
              </div>
            )}

            {stages.map((s, si) => {
              const stagePassed = s.modules.filter((m) => m.passed).length;
              const stageDone = stagePassed === s.modules.length;
              return (
              <section key={s.stage}>
                <div className="flex items-center gap-3 mb-3.5">
                  <span
                    className={`grid place-items-center w-7 h-7 rounded-full text-[13px] font-extrabold ${
                      stageDone
                        ? "bg-life-teal/15 text-life-teal"
                        : "bg-life-blue/10 text-life-blue"
                    }`}
                  >
                    {stageDone ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      si + 1
                    )}
                  </span>
                  <h3 className="font-sans font-extrabold text-life-heading text-[16px] tracking-tight">
                    {s.stage}
                  </h3>
                  <span className="text-[11.5px] font-semibold text-life-bodyLight tabular-nums">
                    {stagePassed}/{s.modules.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {s.modules.map((m) => (
                    <ModuleCard
                      key={m.id}
                      m={m}
                      isNext={data?.next_module_id === m.id}
                      c={c}
                      dimLabel={dimLabel}
                    />
                  ))}
                </div>
              </section>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function ModuleCard({
  m,
  isNext,
  c,
  dimLabel,
}: {
  m: Module;
  isNext: boolean;
  c: Record<string, string>;
  dimLabel: (d: string) => string;
}) {
  const locked = !m.unlocked;
  const gateText = `${dimLabel(m.gate.dimension)} ≥ ${m.gate.min_score}${
    m.gate.overall_min ? ` ${c.overallSuffix}` : ""
  }`;

  return (
    <div
      className={`life-card p-5 transition ${locked ? "opacity-60" : ""} ${
        isNext ? "ring-2 ring-life-blue/40" : ""
      } ${m.passed ? "border border-life-teal/25" : ""}`}
    >
      <div className="flex items-start gap-4">
        {/* Status marker */}
        <div className="shrink-0 pt-0.5">
          {m.passed ? (
            <span className="grid place-items-center w-9 h-9 rounded-full bg-life-teal/15 text-life-teal">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
          ) : locked ? (
            <span className="grid place-items-center w-9 h-9 rounded-full bg-life-blue/8 text-life-bodyLight">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
            </span>
          ) : (
            <span className="grid place-items-center w-9 h-9 rounded-full bg-life-blue/10 text-life-blue text-[14px] font-extrabold">
              {m.order}
            </span>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <h4 className="font-sans font-extrabold text-life-heading text-[15.5px] leading-snug">
              {m.title}
            </h4>
            <span className="text-[10px] uppercase tracking-[0.1em] font-bold text-life-blue bg-life-blue/8 rounded-full px-2 py-0.5">
              {c.focusLabel}: {dimLabel(m.dimension)}
            </span>
            {isNext && !m.passed && (
              <span className="text-[10px] uppercase tracking-[0.1em] font-bold text-life-amberDark bg-life-amber/15 rounded-full px-2 py-0.5">
                {c.next}
              </span>
            )}
          </div>
          <p className="text-[13px] leading-relaxed text-life-body">{m.summary}</p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 text-[11.5px] text-life-bodyLight">
            <span>
              <span className="font-semibold text-life-body">{c.gateLabel}:</span> {gateText}
            </span>
            {m.attempts > 0 && (
              <>
                <span>
                  <span className="font-semibold text-life-body">{c.bestLabel}:</span> {m.best_score}/10
                </span>
                <span>
                  <span className="font-semibold text-life-body">{c.attemptsLabel}:</span> {m.attempts}
                </span>
              </>
            )}
          </div>

          {/* Action */}
          <div className="mt-3.5">
            {locked ? (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-life-bodyLight">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
                {c.lockedHint}
              </span>
            ) : (
              <Link
                href={`/?module=${m.id}`}
                className={`inline-flex items-center gap-2 text-[13px] font-semibold rounded-full px-4 py-2 shadow-soft transition ${
                  m.passed
                    ? "border border-life-blue/25 text-life-blue hover:border-life-blue/50 hover:bg-life-blue/[0.05]"
                    : "bg-life-blue hover:brightness-110 text-white"
                }`}
              >
                <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-life-amber" />
                {m.passed ? c.retry : c.start}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
