"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { FetchError } from "@/components/FetchError";
import { SectionTitle } from "@/components/SectionTitle";
import { FlameIcon, MedalIcon, CheckIcon, ClockIcon } from "@/components/icons";
import { authedFetch } from "@/lib/api";
import { readCache, writeCache } from "@/lib/swr";
import { t, type Lang } from "@/lib/i18n";

type Badge = { id: string; name: string; description: string };

type Stats = {
  total_sessions: number;
  total_xp: number;
  level: number;
  xp_into_level: number;
  xp_per_level: number;
  streak: number;
  daily_goal: number;
  done_today: number;
  averages: Record<string, number>;
  trend: Record<string, number[]>;
  weakest_dimension: string | null;
  strongest_dimension: string | null;
  badges: Badge[];
};

type HistoryItem = {
  id: string;
  persona_name: string;
  overall_score: number;
  turn_count: number;
  xp_earned: number;
  created_at: string;
};

type Drill = {
  id: string;
  title: string;
  dimension: string;
  summary: string;
};

type NextRec = { dimension?: string; persona_id?: string; average?: number };

const DIMS = [
  "rapport",
  "discovery",
  "product_knowledge",
  "objection_handling",
  "closing",
] as const;

export default function ProgressPage() {
  const [lang, setLang] = useState<Lang>("id");
  const [stats, setStats] = useState<Stats | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [next, setNext] = useState<NextRec | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const tr = t[lang];

  const dimLabel = (d: string) => (tr as Record<string, string>)[d] ?? d;

  type ProgressData = {
    stats: Stats | null;
    history: HistoryItem[];
    drills: Drill[];
    next: NextRec | null;
  };

  function apply(d: ProgressData) {
    setStats(d.stats);
    setHistory(d.history || []);
    setDrills(d.drills || []);
    setNext(d.next && d.next.dimension ? d.next : null);
  }

  // `bg` = background revalidation: we already painted cached data, so don't
  // flip the skeleton on and don't surface transient errors over good data.
  function loadProgress(bg = false) {
    if (!bg) setLoading(true);
    setFetchError(false);
    Promise.all([
      authedFetch("/api/training/progress").then((r) =>
        r.ok ? r.json() : null,
      ),
      authedFetch("/api/training/history").then((r) =>
        r.ok ? r.json() : [],
      ),
      authedFetch("/api/training/drills").then((r) => (r.ok ? r.json() : [])),
      authedFetch("/api/training/next").then((r) =>
        r.ok ? r.json() : null,
      ),
    ])
      .then(([s, hist, dr, nx]) => {
        const d: ProgressData = {
          stats: s,
          history: hist || [],
          drills: dr || [],
          next: nx || null,
        };
        apply(d);
        writeCache("progress", d);
      })
      .catch(() => { if (!bg) setFetchError(true); })
      .finally(() => setLoading(false));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const cached = readCache<ProgressData>("progress");
    if (cached) {
      apply(cached);
      setLoading(false);
      loadProgress(true); // revalidate silently in the background
    } else {
      loadProgress();
    }
  }, []);

  const hasData = stats && stats.total_sessions > 0;

  return (
    <AppShell lang={lang} onLang={setLang} current="progress">

      {/* Hero band — blue→teal gradient with the title + key stats */}
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
        <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-8 pt-9 pb-14 animate-riseIn">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-white/90" />
            <span className="h-1 w-10 rounded-full bg-white/70" />
            <span className="ml-1 text-[11.5px] font-bold uppercase tracking-[0.13em] text-white/85">
              {tr.navProgress}
            </span>
          </div>
          <h2
            className="font-sans font-extrabold text-white text-[30px] sm:text-[40px] leading-[1.08] tracking-tight"
            style={{ letterSpacing: "-0.025em" }}
          >
            {tr.progressTitle}
          </h2>
          <p className="text-[14.5px] leading-[1.6] text-white/80 mt-2.5 max-w-[620px]">
            {tr.progressSubtitle}
          </p>

          {hasData && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-8">
              <HeroStat label={tr.statLevel} value={stats!.level}>
                <div className="mt-2 h-1.5 rounded-full overflow-hidden bg-white/20">
                  <div
                    className="h-full rounded-full bg-white"
                    style={{ width: `${(stats!.xp_into_level / stats!.xp_per_level) * 100}%` }}
                  />
                </div>
                <p className="text-[10px] text-white/70 mt-1.5">
                  {stats!.xp_into_level} / {stats!.xp_per_level} XP
                </p>
              </HeroStat>
              <HeroStat label={tr.statXp} value={stats!.total_xp} />
              <HeroStat
                label={tr.statStreak}
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <FlameIcon size={24} className="text-life-amber" />
                    {stats!.streak}
                  </span>
                }
                sub={tr.daysUnit}
              />
              <HeroStat label={tr.statSessions} value={stats!.total_sessions} />
            </div>
          )}
        </div>
      </section>

      <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-8 py-9 -mt-7">
        {loading ? (
          <div className="space-y-5 animate-fadeIn">
            {/* Daily goal skeleton */}
            <div className="life-card p-5 flex items-center gap-4">
              <div className="skeleton w-11 h-11 rounded-[13px]" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3 w-24" />
                <div className="skeleton h-5 w-48" />
              </div>
            </div>
            {/* Next rec skeleton */}
            <div className="life-card p-6 flex items-center justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="skeleton h-3 w-32" />
                <div className="skeleton h-6 w-56" />
              </div>
              <div className="skeleton h-10 w-32 rounded-full" />
            </div>
            {/* Skill breakdown skeleton */}
            <div className="life-card p-7 space-y-4">
              <div className="skeleton h-3 w-28 mb-4" />
              {[1,2,3,4,5].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <div className="skeleton h-3 w-28" />
                  <div className="skeleton h-2.5 flex-1 rounded-full" />
                  <div className="skeleton h-4 w-8" />
                </div>
              ))}
            </div>
          </div>
        ) : fetchError ? (
          <FetchError message={tr.fetchError} onRetry={loadProgress} />
        ) : !hasData ? (
          <div className="life-card p-10 text-center max-w-[460px]">
            <p className="text-life-body text-[15px] mb-5">{tr.noHistory}</p>
            <Link href="/" className="btn-life">
              <span className="w-1.5 h-1.5 rounded-full bg-life-amber" />
              {tr.emptyProgressCta}
            </Link>
          </div>
        ) : (
          <div className="space-y-7">
            {/* Daily goal */}
            {(() => {
              const done = stats!.done_today >= stats!.daily_goal;
              return (
                <div
                  className={`life-card card-goal p-5 flex items-center gap-4 ${done ? "is-done" : ""}`}
                >
                  <span
                    className="life-icon"
                    style={{
                      width: 44,
                      height: 44,
                      background: done
                        ? "linear-gradient(150deg, #1f9d57, #19a594)"
                        : "linear-gradient(150deg, #0a55ab, #1786b1)",
                    }}
                  >
                    {done ? <CheckIcon size={20} /> : <ClockIcon size={20} />}
                  </span>
                  <div>
                    <div className="life-eyebrow text-[10px]">{tr.dailyGoalTitle}</div>
                    <p className="font-sans font-bold text-life-heading text-[17px] leading-snug mt-0.5">
                      {done ? tr.dailyGoalDone : tr.dailyGoalTodo}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Recommended next */}
            {next && next.persona_id && (
              <div className="life-card p-6 flex flex-wrap items-center gap-4 justify-between">
                <div>
                  <div className="life-eyebrow">{tr.recommendedNext}</div>
                  <p className="font-sans font-bold text-life-heading text-[20px] leading-snug mt-1">
                    {dimLabel(next.dimension!)}
                    <span className="text-life-body text-[14px] font-normal">
                      {" "}
                      · {tr.avgLabel} {next.average}/10
                    </span>
                  </p>
                </div>
                <Link href={`/?persona=${next.persona_id}`} className="btn-life-amber">
                  <span className="w-1.5 h-1.5 rounded-full bg-life-heading/70" />
                  {tr.practiceNow}
                </Link>
              </div>
            )}

            {/* Score progression over sessions */}
            {history.length >= 2 && (
              <div className="life-card p-7">
                <div className="flex items-center gap-2 mb-5">
                  <span className="life-eyebrow">
                    {lang === "id" ? "Progres skor" : "Score progression"}
                  </span>
                  <span className="h-px flex-1 max-w-[60px] bg-life-blue/15" />
                  <ScoreDelta history={history} lang={lang} />
                </div>
                <ScoreTrend history={history} lang={lang} />
              </div>
            )}

            {/* Skill breakdown */}
            <div className="life-card p-7">
              <div className="flex items-center gap-2 mb-5">
                <span className="life-eyebrow">{tr.skillBreakdown}</span>
                <span className="h-px flex-1 max-w-[60px] bg-life-blue/15" />
              </div>
              <div className="space-y-4">
                {DIMS.map((d) => {
                  const avg = stats!.averages[d] ?? 0;
                  const isWeak = stats!.weakest_dimension === d;
                  const isStrong = stats!.strongest_dimension === d;
                  return (
                    <div key={d}>
                      <div className="flex items-baseline justify-between mb-1.5 gap-2">
                        <span className="text-[13.5px] text-life-heading/90 flex items-center gap-2">
                          {dimLabel(d)}
                          {isStrong && (
                            <span className="text-[9px] uppercase tracking-[0.12em] font-bold text-life-pos">
                              {tr.strongestLabel}
                            </span>
                          )}
                          {isWeak && !isStrong && (
                            <span className="text-[9px] uppercase tracking-[0.12em] font-bold text-life-neg">
                              {tr.weakestLabel}
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-3">
                          <Sparkline values={stats!.trend[d] ?? []} />
                          <span className="font-sans font-bold text-life-heading text-[15px] tabular-nums">
                            {avg}
                            <span className="text-life-body text-[12px] font-normal"> / 10</span>
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden bg-life-blue/[0.08]">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${(avg / 10) * 100}%`,
                            background:
                              avg >= 7
                                ? "linear-gradient(90deg, #0a55ab, #19b8a6)"
                                : avg >= 4
                                ? "linear-gradient(90deg, #1582b3, #19b8a6)"
                                : "linear-gradient(90deg, #c0392b, #e8836f)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Badges */}
            <div className="life-card p-7">
              <div className="flex items-center gap-2 mb-5">
                <span className="life-eyebrow">{tr.badgesTitle}</span>
                <span className="h-px flex-1 max-w-[60px] bg-life-blue/15" />
              </div>
              {stats!.badges.length === 0 ? (
                <p className="text-[13.5px] text-life-body italic">{tr.noBadges}</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {stats!.badges.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center gap-2.5 rounded-[14px] p-3 pr-4 border border-life-blue/12 bg-life-blueBg/60"
                      title={b.description}
                    >
                      <span
                        className="life-icon"
                        style={{ width: 32, height: 32, borderRadius: 999 }}
                      >
                        <MedalIcon size={17} />
                      </span>
                      <div className="leading-tight">
                        <div className="font-sans font-bold text-life-heading text-[14px]">
                          {b.name}
                        </div>
                        <div className="text-[10.5px] text-life-body">
                          {b.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Focus drills */}
            <div className="life-card p-7">
              <div className="flex items-center gap-2 mb-1">
                <span className="life-eyebrow">{tr.drillsTitle}</span>
                <span className="h-px flex-1 max-w-[60px] bg-life-blue/15" />
              </div>
              <p className="text-[12.5px] text-life-body mb-5">{tr.drillsSubtitle}</p>
              <div className="grid sm:grid-cols-2 gap-4">
                {drills.map((d) => (
                  <div
                    key={d.id}
                    className="rounded-[14px] border border-life-blue/12 p-4 flex flex-col gap-3 bg-life-card"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-sans font-bold text-life-heading text-[15.5px]">
                          {d.title}
                        </span>
                        <span className="text-[9px] uppercase tracking-[0.12em] font-bold text-life-teal">
                          {dimLabel(d.dimension)}
                        </span>
                      </div>
                      <p className="text-[12.5px] text-life-body leading-snug mt-1">
                        {d.summary}
                      </p>
                    </div>
                    <Link
                      href={`/?drill=${d.id}`}
                      className="self-start inline-flex items-center gap-2 bg-life-blue hover:brightness-110 text-white text-[12.5px] font-semibold rounded-full px-4 py-2 shadow-lifeBlue transition"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-life-amber" />
                      {tr.startDrill}
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            {/* History */}
            <div className="life-card p-7">
              <div className="flex items-center gap-2 mb-5">
                <span className="life-eyebrow">{tr.historyTitle}</span>
                <span className="h-px flex-1 max-w-[60px] bg-life-blue/15" />
              </div>
              <div className="divide-y divide-life-blue/10">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <span
                      className="font-sans font-extrabold text-white rounded-full flex items-center justify-center shrink-0"
                      style={{
                        width: 38,
                        height: 38,
                        background:
                          h.overall_score >= 7
                            ? "#1f9d57"
                            : h.overall_score >= 4
                            ? "#0a55ab"
                            : "#c0392b",
                        fontSize: 15,
                      }}
                    >
                      {h.overall_score}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] text-life-heading font-semibold truncate">
                        {h.persona_name}
                      </div>
                      <div className="text-[11.5px] text-life-body">
                        {h.turn_count} {tr.reportTurns} · +{h.xp_earned} XP ·{" "}
                        {new Date(h.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

// Stat tile rendered on the blue→teal hero band (white text on a translucent
// glass card).
function HeroStat({
  label,
  value,
  sub,
  children,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-[14px] p-4 bg-white/10 border border-white/15 backdrop-blur-sm">
      <div className="text-[10px] font-bold uppercase tracking-[0.13em] text-white/70">
        {label}
      </div>
      <div
        className="font-sans font-extrabold text-white mt-1.5 leading-none flex items-baseline gap-1.5"
        style={{ fontSize: 32, letterSpacing: "-0.03em" }}
      >
        {value}
        {sub && (
          <span className="text-[12px] font-semibold text-white/65">{sub}</span>
        )}
      </div>
      {children}
    </div>
  );
}

// Chronological list of overall scores (history arrives newest-first).
function chronoScores(history: HistoryItem[]): HistoryItem[] {
  return [...history].reverse();
}

function ScoreDelta({
  history,
  lang,
}: {
  history: HistoryItem[];
  lang: Lang;
}) {
  const pts = chronoScores(history);
  const first = pts[0].overall_score;
  const last = pts[pts.length - 1].overall_score;
  const delta = last - first;
  const up = delta >= 0;
  const color = delta > 0 ? "#1f9d57" : delta < 0 ? "#c0392b" : "#5a6b82";
  return (
    <span
      className="text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-full"
      style={{ color, background: `${color}14` }}
      title={
        lang === "id"
          ? "Perubahan skor dari sesi pertama ke terakhir"
          : "Change from first to latest session"
      }
    >
      {up ? "▲" : "▼"} {up ? "+" : ""}
      {delta} {lang === "id" ? "sejak awal" : "since start"}
    </span>
  );
}

function ScoreTrend({
  history,
  lang,
}: {
  history: HistoryItem[];
  lang: Lang;
}) {
  const pts = chronoScores(history).slice(-12);
  const w = 640;
  const h = 130;
  const padX = 14;
  const padY = 16;
  const max = 10;
  const n = pts.length;
  const step = n > 1 ? (w - padX * 2) / (n - 1) : 0;
  const x = (i: number) => padX + i * step;
  const y = (v: number) => padY + (1 - v / max) * (h - padY * 2);

  const line = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.overall_score).toFixed(1)}`).join(" ");
  const area = `${padX},${(h - padY).toFixed(1)} ${line} ${x(n - 1).toFixed(1)},${(h - padY).toFixed(1)}`;

  return (
    <div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={lang === "id" ? "Grafik progres skor" : "Score progression chart"}
      >
        <defs>
          <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0a55ab" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#19b8a6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="scoreLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0a55ab" />
            <stop offset="100%" stopColor="#19b8a6" />
          </linearGradient>
        </defs>
        {/* gridlines at 5 and 8 */}
        {[5, 8].map((g) => (
          <line
            key={g}
            x1={padX}
            x2={w - padX}
            y1={y(g)}
            y2={y(g)}
            stroke="var(--chart-grid)"
            strokeWidth="1"
            strokeDasharray="3 4"
          />
        ))}
        <polygon points={area} fill="url(#scoreFill)" />
        <polyline
          points={line}
          fill="none"
          stroke="url(#scoreLine)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {pts.map((p, i) => (
          <circle
            key={p.id}
            cx={x(i)}
            cy={y(p.overall_score)}
            r="3.4"
            fill="var(--surface-1)"
            stroke={
              p.overall_score >= 7
                ? "var(--life-pos)"
                : p.overall_score >= 4
                ? "var(--life-blue)"
                : "var(--life-neg)"
            }
            strokeWidth="2"
          >
            <title>
              {p.persona_name} · {p.overall_score}/10
            </title>
          </circle>
        ))}
      </svg>
      <div className="flex justify-between text-[10.5px] text-life-bodyLight mt-1 px-1">
        <span>
          {lang === "id" ? "Sesi terlama" : "Oldest"} ·{" "}
          {new Date(pts[0].created_at).toLocaleDateString()}
        </span>
        <span>
          {lang === "id" ? "Terbaru" : "Latest"} ·{" "}
          {new Date(pts[pts.length - 1].created_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (!values || values.length < 2) return null;
  const w = 56;
  const h = 16;
  const max = 10;
  const step = w / (values.length - 1);
  const pts = values
    .map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible" aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke="#9db8d6"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
