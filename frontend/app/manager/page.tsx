"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { FetchError } from "@/components/FetchError";
import { authedFetch } from "@/lib/api";
import { readCache, writeCache } from "@/lib/swr";
import { useAuth } from "@/components/AuthProvider";
import { t, type Lang } from "@/lib/i18n";

const DIMS = [
  "rapport",
  "discovery",
  "product_knowledge",
  "objection_handling",
  "closing",
] as const;

// An FA's overall practice quality: mean of the five dimension averages.
function memberAvg(averages: Record<string, number>): number {
  const vals = DIMS.map((d) => averages?.[d] ?? 0);
  return vals.length
    ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
    : 0;
}

type Member = {
  uid: string;
  name: string;
  email: string;
  picture: string;
  total_sessions: number;
  level: number;
  total_xp: number;
  averages: Record<string, number>;
  weakest_dimension: string | null;
  last_overall: number;
};

type Overview = {
  member_count: number;
  sessions_total: number;
  team_averages: Record<string, number>;
  team_weakest_dimension: string | null;
  members: Member[];
};

export default function ManagerPage() {
  const { user, signOut } = useAuth();
  const [lang, setLang] = useState<Lang>("id");
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [data, setData] = useState<Overview | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const tr = t[lang];
  const dimLabel = (d: string) => (tr as Record<string, string>)[d] ?? d;

  function loadDashboard() {
    // Paint cached overview instantly (if any) so a revisit doesn't block on
    // the backend cold start; then revalidate in the background.
    const cached = readCache<Overview>("manager.overview");
    const bg = !!cached;
    if (cached) { setAuthed(true); setData(cached); setChecking(false); }
    else setChecking(true);
    setFetchError(false);
    let alive = true;
    authedFetch("/api/admin/overview")
      .then(async (res) => {
        if (!alive) return;
        if (res.ok) {
          const d: Overview = await res.json();
          setAuthed(true);
          setData(d);
          writeCache("manager.overview", d);
        } else {
          setAuthed(false);
        }
      })
      .catch(() => { if (alive && !bg) { setAuthed(false); setFetchError(true); } })
      .finally(() => alive && setChecking(false));
    return () => { alive = false; };
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const cleanup = loadDashboard(); return cleanup; }, [user]);

  if (checking) {
    return (
      <main className="min-h-screen bg-life px-6 py-10">
        <div className="max-w-4xl mx-auto space-y-5 animate-fadeIn">
          <div className="skeleton h-8 w-48 mb-6" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <div key={i} className="life-card p-5 space-y-2"><div className="skeleton h-3 w-16" /><div className="skeleton h-7 w-12" /></div>)}
          </div>
          <div className="life-card p-6 space-y-3">
            <div className="skeleton h-3 w-32" />
            {[1,2,3].map(i => <div key={i} className="flex items-center gap-3"><div className="skeleton h-3 w-24" /><div className="skeleton h-2.5 flex-1 rounded-full" /><div className="skeleton h-4 w-8" /></div>)}
          </div>
        </div>
      </main>
    );
  }

  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-life px-4">
        {fetchError ? (
          <FetchError message={tr.fetchError} onRetry={loadDashboard} />
        ) : (
        <div className="life-card p-8 text-center max-w-md">
          <h1 className="font-sans font-extrabold text-life-heading text-[22px]">
            {tr.accessDenied}
          </h1>
          <p className="text-[13px] text-life-body mt-2">
            {user
              ? `${user.email ?? ""} ${lang === "id" ? "bukan akun manajer/admin." : "is not a manager/admin account."}`
              : lang === "id"
                ? "Masuk dengan akun admin."
                : "Sign in with an admin account."}
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link href="/" className="text-[12px] smallcaps text-life-body hover:text-life-blue">
              ← {tr.navTrain}
            </Link>
            {user && (
              <button
                onClick={() => signOut()}
                className="text-[12px] font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-full px-3 py-1.5"
              >
                {tr.switchAccount}
              </button>
            )}
          </div>
        </div>
        )}
      </main>
    );
  }

  const ov = data;

  return (
    <AppShell lang={lang} onLang={setLang} current="manager">

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
        <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-8 pt-9 pb-14 animate-riseIn">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-white/90" />
            <span className="h-1 w-10 rounded-full bg-white/70" />
            <span className="ml-1 text-[11.5px] font-bold uppercase tracking-[0.13em] text-white/85">
              {lang === "id" ? "Dashboard Manajer" : "Manager Dashboard"}
            </span>
          </div>
          <h2
            className="font-sans font-extrabold text-white text-[30px] sm:text-[38px] leading-[1.08] tracking-tight"
            style={{ letterSpacing: "-0.025em" }}
          >
            {lang === "id" ? "Performa tim Anda" : "Your team at a glance"}
          </h2>
          <p className="text-[14.5px] leading-[1.6] text-white/80 mt-2.5 max-w-[560px]">
            {lang === "id"
              ? "Pantau aktivitas latihan, rata-rata skor, dan area yang perlu difokuskan tim."
              : "Track practice activity, average scores, and where the team needs focus."}
          </p>
        </div>
      </section>

      <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-8 py-9 -mt-7 space-y-8">
        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi label={lang === "id" ? "Anggota aktif" : "Active members"} value={ov?.member_count ?? 0} accent="#0a55ab" />
          <Kpi label={lang === "id" ? "Total sesi" : "Total sessions"} value={ov?.sessions_total ?? 0} accent="#1582b3" />
          <Kpi
            label={lang === "id" ? "Rata-rata tim" : "Team average"}
            value={avgOfAverages(ov?.team_averages)}
            suffix="/10"
            accent="#19b8a6"
          />
          <Kpi
            label={lang === "id" ? "Perlu fokus" : "Needs focus"}
            text={ov?.team_weakest_dimension ? dimLabel(ov.team_weakest_dimension) : "—"}
            accent="#F9B233"
          />
        </div>

        {/* Team averages per dimension */}
        <section className="life-card p-7">
          <div className="flex items-center gap-2 mb-5">
            <span className="life-eyebrow">
              {lang === "id" ? "Rata-rata per dimensi" : "Average per dimension"}
            </span>
            <span className="h-px flex-1 max-w-[60px] bg-life-blue/15" />
          </div>
          <div className="space-y-3.5">
            {DIMS.map((d) => {
              const v = ov?.team_averages?.[d] ?? 0;
              return (
                <div key={d} className="flex items-center gap-3">
                  <div className="w-40 text-[12.5px] text-life-heading/90 shrink-0">{dimLabel(d)}</div>
                  <div className="flex-1 h-2.5 rounded-full bg-life-blue/[0.08] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (v / 10) * 100)}%`,
                        background:
                          v >= 7
                            ? "linear-gradient(90deg, #0a55ab, #19b8a6)"
                            : v >= 4
                            ? "linear-gradient(90deg, #1582b3, #19b8a6)"
                            : "linear-gradient(90deg, #c0392b, #e8836f)",
                      }}
                    />
                  </div>
                  <div className="w-10 text-right text-[12.5px] font-bold text-life-heading tabular-nums">
                    {v.toFixed(1)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Member table */}
        <section className="life-card p-5 sm:p-7">
          <div className="flex items-center gap-2 mb-5">
            <span className="life-eyebrow">
              {lang === "id" ? "Anggota tim" : "Team members"}
            </span>
            <span className="h-px flex-1 max-w-[60px] bg-life-blue/15" />
          </div>

          {/* Mobile: stacked member cards (no horizontal scroll) */}
          <div className="md:hidden space-y-3">
            {(ov?.members ?? []).map((m) => (
              <div
                key={m.uid}
                className="rounded-2xl border border-life-blue/12 bg-life-item/60 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full overflow-hidden grid place-items-center shrink-0 life-icon">
                    {m.picture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.picture} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-white text-[13px] font-bold">
                        {(m.name || "?").charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-life-heading truncate">{m.name}</div>
                    <div className="text-[11px] text-life-body truncate">{m.email}</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-white/50 py-1.5">
                    <div className="text-[10px] uppercase tracking-wide text-life-bodyLight">{lang === "id" ? "Rata-rata" : "Avg"}</div>
                    <div className="text-[15px] font-bold text-life-blue tabular-nums">{memberAvg(m.averages).toFixed(1)}</div>
                  </div>
                  <div className="rounded-lg bg-white/50 py-1.5">
                    <div className="text-[10px] uppercase tracking-wide text-life-bodyLight">{lang === "id" ? "Sesi" : "Sessions"}</div>
                    <div className="text-[15px] font-bold text-life-heading">{m.total_sessions}</div>
                  </div>
                  <div className="rounded-lg bg-white/50 py-1.5">
                    <div className="text-[10px] uppercase tracking-wide text-life-bodyLight">{lang === "id" ? "Terakhir" : "Last"}</div>
                    <div className="text-[15px] font-bold text-life-heading tabular-nums">{m.last_overall}</div>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-1.5 text-[12px]">
                  <span className="text-life-bodyLight">{lang === "id" ? "Perlu fokus:" : "Needs focus:"}</span>
                  <span className="font-medium text-life-body">
                    {m.weakest_dimension ? dimLabel(m.weakest_dimension) : "—"}
                  </span>
                </div>
              </div>
            ))}
            {(ov?.members ?? []).length === 0 && (
              <div className="py-8 text-center text-life-body">
                {lang === "id" ? "Belum ada data latihan." : "No training data yet."}
              </div>
            )}
          </div>

          {/* Desktop: full table */}
          <table className="hidden md:table w-full text-[13px]">
            <thead>
              <tr className="text-life-bodyLight text-[11px] uppercase tracking-wide text-left border-b border-life-blue/12">
                <th className="py-2 pr-3 font-semibold">FA</th>
                <th className="py-2 px-3 font-semibold">{lang === "id" ? "Rata-rata" : "Avg"}</th>
                <th className="py-2 px-3 font-semibold">{lang === "id" ? "Sesi" : "Sessions"}</th>
                <th className="py-2 px-3 font-semibold">{lang === "id" ? "Terakhir" : "Last"}</th>
                <th className="py-2 px-3 font-semibold">{lang === "id" ? "Perlu fokus" : "Needs focus"}</th>
              </tr>
            </thead>
            <tbody>
              {(ov?.members ?? []).map((m) => (
                <tr key={m.uid} className="border-b border-life-blue/[0.08]">
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full overflow-hidden grid place-items-center shrink-0 life-icon">
                        {m.picture ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.picture} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-white text-[12px] font-bold">
                            {(m.name || "?").charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-life-heading truncate">{m.name}</div>
                        <div className="text-[11px] text-life-body truncate">{m.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 font-bold text-life-blue tabular-nums">{memberAvg(m.averages).toFixed(1)}</td>
                  <td className="py-2.5 px-3 text-life-heading">{m.total_sessions}</td>
                  <td className="py-2.5 px-3 text-life-heading tabular-nums">{m.last_overall}</td>
                  <td className="py-2.5 px-3 text-life-body">
                    {m.weakest_dimension ? dimLabel(m.weakest_dimension) : "—"}
                  </td>
                </tr>
              ))}
              {(ov?.members ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-life-body">
                    {lang === "id" ? "Belum ada data latihan." : "No training data yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </AppShell>
  );
}

function avgOfAverages(a?: Record<string, number>): number {
  if (!a) return 0;
  const vals = DIMS.map((d) => a[d] ?? 0);
  const sum = vals.reduce((x, y) => x + y, 0);
  return vals.length ? Math.round((sum / vals.length) * 10) / 10 : 0;
}

function Kpi({
  label,
  value,
  text,
  suffix,
  accent,
}: {
  label: string;
  value?: number;
  text?: string;
  suffix?: string;
  accent?: string;
}) {
  return (
    <div className="life-card p-4 relative overflow-hidden">
      {accent && (
        <span
          aria-hidden
          className="absolute top-0 left-0 h-1 w-12 rounded-br"
          style={{ background: accent }}
        />
      )}
      <div className="text-[11px] uppercase tracking-wide text-life-body font-semibold">{label}</div>
      <div className="mt-1.5 font-sans font-extrabold text-life-heading text-[26px] leading-none" style={{ letterSpacing: "-0.02em" }}>
        {text ?? value}
        {suffix && <span className="text-[14px] text-life-body font-normal">{suffix}</span>}
      </div>
    </div>
  );
}
