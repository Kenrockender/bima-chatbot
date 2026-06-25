"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BimaAvatar } from "@/components/BimaAvatar";
import { AppNav } from "@/components/AppNav";
import { authedFetch } from "@/lib/api";
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
  const tr = t[lang];

  const dimLabel = (d: string) => (tr as Record<string, string>)[d] ?? d;

  useEffect(() => {
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
        setStats(s);
        setHistory(hist || []);
        setDrills(dr || []);
        setNext(nx && nx.dimension ? nx : null);
      })
      .finally(() => setLoading(false));
  }, []);

  const hasData = stats && stats.total_sessions > 0;

  return (
    <main className="min-h-screen bg-canvas relative overflow-hidden">
      <span className="watermark-b">B</span>

      {/* Header */}
      <header className="relative z-40 border-b border-bca-rule/70 bg-bca-cream/70 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 pt-5 pb-4">
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
                  <span className="smallcaps text-bca-gold">{tr.navProgress}</span>
                </div>
                <p className="text-[12.5px] text-bca-mute mt-1 tracking-wide">
                  BCA Life · Advisor Cockpit
                </p>
              </div>
            </div>

            <AppNav lang={lang} onLang={setLang} current="progress" />
          </div>
          <div className="gold-rule mt-4" />
        </div>
      </header>

      <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-8 py-10">
        <div className="animate-riseIn mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="block w-7 h-px bg-bca-gold" />
            <span className="smallcaps text-bca-gold">{tr.navProgress}</span>
          </div>
          <h2
            className="font-serif text-bca-ink text-[34px] sm:text-[42px] leading-[1.1] tracking-tight"
            style={{ fontWeight: 400, letterSpacing: "-0.025em" }}
          >
            {tr.progressTitle}
          </h2>
          <p className="text-[15px] leading-[1.6] text-bca-mute mt-3 max-w-[620px]">
            {tr.progressSubtitle}
          </p>
        </div>

        {loading ? (
          <p className="text-bca-mute italic">…</p>
        ) : !hasData ? (
          <div className="surface-paper rounded-[18px] shadow-paper p-10 text-center max-w-[460px]">
            <p className="text-bca-ink/75 text-[15px] mb-5">{tr.noHistory}</p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-bca-navy hover:bg-bca-ink text-bca-cream text-[14px] font-medium rounded-full px-6 py-3 shadow-soft transition"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-bca-gold" />
              {tr.emptyProgressCta}
            </Link>
          </div>
        ) : (
          <div className="space-y-7">
            {/* Stat row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label={tr.statLevel} value={stats!.level} accent="#003D7A">
                <div className="mt-2 h-1.5 rounded-full overflow-hidden bg-bca-ink/[0.06]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(stats!.xp_into_level / stats!.xp_per_level) * 100}%`,
                      background: "linear-gradient(90deg, #003D7A, #1B6FC9)",
                    }}
                  />
                </div>
                <p className="text-[10.5px] text-bca-mute mt-1.5">
                  {stats!.xp_into_level} / {stats!.xp_per_level} XP
                </p>
              </StatCard>
              <StatCard label={tr.statXp} value={stats!.total_xp} accent="#C8941E" />
              <StatCard
                label={tr.statStreak}
                value={`🔥 ${stats!.streak}`}
                accent="#B23A3A"
              >
                <p className="text-[10.5px] text-bca-mute mt-1.5">{tr.daysUnit}</p>
              </StatCard>
              <StatCard
                label={tr.statSessions}
                value={stats!.total_sessions}
                accent="#1E7B47"
              />
            </div>

            {/* Daily goal */}
            <div
              className="rounded-[18px] p-5 shadow-paper flex items-center gap-4"
              style={{
                background:
                  stats!.done_today >= stats!.daily_goal
                    ? "linear-gradient(150deg, #F0F7F2 0%, #DCEEE2 100%)"
                    : "linear-gradient(150deg, #FDFBF6 0%, #F4ECDA 100%)",
                border: "1px solid #E6DFD0",
              }}
            >
              <span
                className="flex items-center justify-center rounded-full text-[20px] shrink-0"
                style={{
                  width: 44,
                  height: 44,
                  background:
                    stats!.done_today >= stats!.daily_goal ? "#1E7B47" : "#C8941E",
                }}
              >
                {stats!.done_today >= stats!.daily_goal ? "✓" : "◷"}
              </span>
              <div>
                <div className="smallcaps text-bca-gold text-[10px]">
                  {tr.dailyGoalTitle}
                </div>
                <p className="font-serif text-bca-ink text-[18px] leading-snug">
                  {stats!.done_today >= stats!.daily_goal
                    ? tr.dailyGoalDone
                    : tr.dailyGoalTodo}
                </p>
              </div>
            </div>

            {/* Recommended next */}
            {next && next.persona_id && (
              <div className="surface-paper rounded-[18px] shadow-paper p-6 flex flex-wrap items-center gap-4 justify-between">
                <div>
                  <div className="smallcaps text-bca-navy">{tr.recommendedNext}</div>
                  <p className="font-serif text-bca-ink text-[20px] leading-snug mt-1">
                    {dimLabel(next.dimension!)}
                    <span className="text-bca-mute text-[14px]">
                      {" "}
                      · {tr.avgLabel} {next.average}/10
                    </span>
                  </p>
                </div>
                <Link
                  href={`/?persona=${next.persona_id}`}
                  className="inline-flex items-center gap-2 bg-bca-gold hover:brightness-95 text-bca-ink text-[13.5px] font-semibold rounded-full px-5 py-2.5 shadow-soft transition"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-bca-ink/70" />
                  {tr.practiceNow}
                </Link>
              </div>
            )}

            {/* Score progression over sessions */}
            {history.length >= 2 && (
              <div className="surface-paper rounded-[18px] shadow-paper p-7">
                <div className="flex items-center gap-2 mb-5">
                  <span className="smallcaps text-bca-navy">
                    {lang === "id" ? "Progres skor" : "Score progression"}
                  </span>
                  <span className="h-px flex-1 max-w-[60px] bg-bca-rule" />
                  <ScoreDelta history={history} lang={lang} />
                </div>
                <ScoreTrend history={history} lang={lang} />
              </div>
            )}

            {/* Skill breakdown */}
            <div className="surface-paper rounded-[18px] shadow-paper p-7">
              <div className="flex items-center gap-2 mb-5">
                <span className="smallcaps text-bca-navy">{tr.skillBreakdown}</span>
                <span className="h-px flex-1 max-w-[60px] bg-bca-rule" />
              </div>
              <div className="space-y-4">
                {DIMS.map((d) => {
                  const avg = stats!.averages[d] ?? 0;
                  const isWeak = stats!.weakest_dimension === d;
                  const isStrong = stats!.strongest_dimension === d;
                  return (
                    <div key={d}>
                      <div className="flex items-baseline justify-between mb-1.5 gap-2">
                        <span className="text-[13.5px] text-bca-ink/85 flex items-center gap-2">
                          {dimLabel(d)}
                          {isStrong && (
                            <span className="text-[9px] uppercase tracking-[0.12em] font-bold text-[#1E7B47]">
                              {tr.strongestLabel}
                            </span>
                          )}
                          {isWeak && !isStrong && (
                            <span className="text-[9px] uppercase tracking-[0.12em] font-bold text-[#B23A3A]">
                              {tr.weakestLabel}
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-3">
                          <Sparkline values={stats!.trend[d] ?? []} />
                          <span className="font-serif text-bca-ink text-[15px] tabular-nums">
                            {avg}
                            <span className="text-bca-mute text-[12px]"> / 10</span>
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden bg-bca-ink/[0.06]">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${(avg / 10) * 100}%`,
                            background:
                              avg >= 7
                                ? "linear-gradient(90deg, #C8941E, #E6B85A)"
                                : avg >= 4
                                ? "linear-gradient(90deg, #003D7A, #1B6FC9)"
                                : "linear-gradient(90deg, #B23A3A, #D86B6B)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Badges */}
            <div className="surface-paper rounded-[18px] shadow-paper p-7">
              <div className="flex items-center gap-2 mb-5">
                <span className="smallcaps text-bca-gold">{tr.badgesTitle}</span>
                <span className="h-px flex-1 max-w-[60px] bg-bca-rule" />
              </div>
              {stats!.badges.length === 0 ? (
                <p className="text-[13.5px] text-bca-mute italic">{tr.noBadges}</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {stats!.badges.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center gap-2.5 rounded-[14px] p-3 pr-4"
                      style={{
                        background:
                          "linear-gradient(150deg, #FDFBF6 0%, #F4ECDA 100%)",
                        border: "1px solid #E6DFD0",
                      }}
                      title={b.description}
                    >
                      <span
                        className="flex items-center justify-center rounded-full text-[15px] shrink-0"
                        style={{ width: 32, height: 32, background: "#C8941E" }}
                      >
                        🏅
                      </span>
                      <div className="leading-tight">
                        <div className="font-serif text-bca-ink text-[14px]">
                          {b.name}
                        </div>
                        <div className="text-[10.5px] text-bca-mute">
                          {b.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Focus drills */}
            <div className="surface-paper rounded-[18px] shadow-paper p-7">
              <div className="flex items-center gap-2 mb-1">
                <span className="smallcaps text-bca-navy">{tr.drillsTitle}</span>
                <span className="h-px flex-1 max-w-[60px] bg-bca-rule" />
              </div>
              <p className="text-[12.5px] text-bca-mute mb-5">{tr.drillsSubtitle}</p>
              <div className="grid sm:grid-cols-2 gap-4">
                {drills.map((d) => (
                  <div
                    key={d.id}
                    className="rounded-[14px] border border-bca-rule p-4 flex flex-col gap-3 bg-bca-cream/40"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-serif text-bca-ink text-[16px]">
                          {d.title}
                        </span>
                        <span className="text-[9px] uppercase tracking-[0.12em] font-bold text-bca-gold">
                          {dimLabel(d.dimension)}
                        </span>
                      </div>
                      <p className="text-[12.5px] text-bca-mute leading-snug mt-1">
                        {d.summary}
                      </p>
                    </div>
                    <Link
                      href={`/?drill=${d.id}`}
                      className="self-start inline-flex items-center gap-2 bg-bca-navy hover:bg-bca-ink text-bca-cream text-[12.5px] font-semibold rounded-full px-4 py-2 shadow-soft transition"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-bca-gold" />
                      {tr.startDrill}
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            {/* History */}
            <div className="surface-paper rounded-[18px] shadow-paper p-7">
              <div className="flex items-center gap-2 mb-5">
                <span className="smallcaps text-bca-navy">{tr.historyTitle}</span>
                <span className="h-px flex-1 max-w-[60px] bg-bca-rule" />
              </div>
              <div className="divide-y divide-bca-rule/60">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <span
                      className="font-serif text-white rounded-full flex items-center justify-center shrink-0"
                      style={{
                        width: 38,
                        height: 38,
                        background:
                          h.overall_score >= 7
                            ? "#1E7B47"
                            : h.overall_score >= 4
                            ? "#003D7A"
                            : "#B23A3A",
                        fontSize: 15,
                      }}
                    >
                      {h.overall_score}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] text-bca-ink font-medium truncate">
                        {h.persona_name}
                      </div>
                      <div className="text-[11.5px] text-bca-mute">
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
    </main>
  );
}

function StatCard({
  label,
  value,
  accent,
  children,
}: {
  label: string;
  value: string | number;
  accent: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="surface-paper rounded-[18px] shadow-paper p-5 relative overflow-hidden">
      <span
        aria-hidden
        className="absolute top-0 left-0 h-1 w-12"
        style={{ background: accent }}
      />
      <div className="smallcaps text-bca-mute text-[10px]">{label}</div>
      <div
        className="font-serif text-bca-ink mt-1.5 leading-none"
        style={{ fontWeight: 400, fontSize: 38, letterSpacing: "-0.03em" }}
      >
        {value}
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
  const color = delta > 0 ? "#1E7B47" : delta < 0 ? "#B23A3A" : "#6B7B8F";
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
            <stop offset="0%" stopColor="#003D7A" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#003D7A" stopOpacity="0" />
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
            stroke="#E6DFD0"
            strokeWidth="1"
            strokeDasharray="3 4"
          />
        ))}
        <polygon points={area} fill="url(#scoreFill)" />
        <polyline
          points={line}
          fill="none"
          stroke="#003D7A"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {pts.map((p, i) => (
          <circle
            key={p.id}
            cx={x(i)}
            cy={y(p.overall_score)}
            r="3.4"
            fill="#fff"
            stroke={
              p.overall_score >= 7
                ? "#1E7B47"
                : p.overall_score >= 4
                ? "#003D7A"
                : "#B23A3A"
            }
            strokeWidth="2"
          >
            <title>
              {p.persona_name} · {p.overall_score}/10
            </title>
          </circle>
        ))}
      </svg>
      <div className="flex justify-between text-[10.5px] text-bca-mute mt-1 px-1">
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
        stroke="#6B7B8F"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
