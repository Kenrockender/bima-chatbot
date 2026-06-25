"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BimaAvatar } from "@/components/BimaAvatar";
import { AppNav } from "@/components/AppNav";
import { authedFetch } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { t, type Lang } from "@/lib/i18n";

const DIMS = [
  "rapport",
  "discovery",
  "product_knowledge",
  "objection_handling",
  "closing",
] as const;

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
  const tr = t[lang];
  const dimLabel = (d: string) => (tr as Record<string, string>)[d] ?? d;

  useEffect(() => {
    let alive = true;
    setChecking(true);
    authedFetch("/api/admin/overview")
      .then(async (res) => {
        if (!alive) return;
        if (res.ok) {
          setAuthed(true);
          setData(await res.json());
        } else {
          setAuthed(false);
        }
      })
      .catch(() => alive && setAuthed(false))
      .finally(() => alive && setChecking(false));
    return () => {
      alive = false;
    };
  }, [user]);

  if (checking) {
    return (
      <main className="min-h-screen grid place-items-center bg-canvas">
        <div className="h-8 w-8 rounded-full border-2 border-bca-gold border-t-transparent animate-spin" />
      </main>
    );
  }

  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-canvas px-4">
        <div className="surface-paper rounded-[18px] shadow-paper p-8 text-center max-w-md">
          <h1 className="font-serif text-bca-ink text-[22px]" style={{ fontWeight: 500 }}>
            {lang === "id" ? "Akses ditolak" : "Access denied"}
          </h1>
          <p className="text-[13px] text-bca-mute mt-2">
            {user
              ? `${user.email ?? ""} ${lang === "id" ? "bukan akun manajer/admin." : "is not a manager/admin account."}`
              : lang === "id"
                ? "Masuk dengan akun admin."
                : "Sign in with an admin account."}
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link href="/" className="text-[12px] smallcaps text-bca-mute hover:text-bca-navy">
              ← {tr.navTrain}
            </Link>
            {user && (
              <button
                onClick={() => signOut()}
                className="text-[12px] font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-full px-3 py-1.5"
              >
                {lang === "id" ? "Ganti akun" : "Switch account"}
              </button>
            )}
          </div>
        </div>
      </main>
    );
  }

  const ov = data;

  return (
    <main className="min-h-screen bg-canvas relative overflow-hidden">
      <span className="watermark-b">B</span>

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
                  <span className="smallcaps text-bca-gold">
                    {lang === "id" ? "Dashboard Manajer" : "Manager Dashboard"}
                  </span>
                </div>
                <p className="text-[12.5px] text-bca-mute mt-1 tracking-wide">
                  BCA Life · Team Cockpit
                </p>
              </div>
            </div>
            <AppNav lang={lang} onLang={setLang} current="manager" />
          </div>
          <div className="gold-rule mt-4" />
        </div>
      </header>

      <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-8 py-10 space-y-8">
        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi label={lang === "id" ? "Anggota aktif" : "Active members"} value={ov?.member_count ?? 0} />
          <Kpi label={lang === "id" ? "Total sesi" : "Total sessions"} value={ov?.sessions_total ?? 0} />
          <Kpi
            label={lang === "id" ? "Rata-rata tim" : "Team average"}
            value={avgOfAverages(ov?.team_averages)}
            suffix="/10"
          />
          <Kpi
            label={lang === "id" ? "Perlu fokus" : "Needs focus"}
            text={ov?.team_weakest_dimension ? dimLabel(ov.team_weakest_dimension) : "—"}
          />
        </div>

        {/* Team averages per dimension */}
        <section className="surface-paper rounded-[18px] shadow-paper p-6">
          <div className="smallcaps text-bca-gold mb-4">
            {lang === "id" ? "Rata-rata per dimensi" : "Average per dimension"}
          </div>
          <div className="space-y-3">
            {DIMS.map((d) => {
              const v = ov?.team_averages?.[d] ?? 0;
              return (
                <div key={d} className="flex items-center gap-3">
                  <div className="w-40 text-[12.5px] text-bca-ink shrink-0">{dimLabel(d)}</div>
                  <div className="flex-1 h-2.5 rounded-full bg-bca-line overflow-hidden">
                    <div
                      className="h-full rounded-full bg-bca-navy"
                      style={{ width: `${Math.min(100, (v / 10) * 100)}%` }}
                    />
                  </div>
                  <div className="w-10 text-right text-[12.5px] font-semibold text-bca-navy">
                    {v.toFixed(1)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Member table */}
        <section className="surface-paper rounded-[18px] shadow-paper p-6 overflow-x-auto">
          <div className="smallcaps text-bca-gold mb-4">
            {lang === "id" ? "Anggota tim" : "Team members"}
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-bca-mute text-[11px] uppercase tracking-wide text-left border-b border-bca-rule">
                <th className="py-2 pr-3 font-semibold">FA</th>
                <th className="py-2 px-3 font-semibold">Level</th>
                <th className="py-2 px-3 font-semibold">XP</th>
                <th className="py-2 px-3 font-semibold">{lang === "id" ? "Sesi" : "Sessions"}</th>
                <th className="py-2 px-3 font-semibold">{lang === "id" ? "Perlu fokus" : "Needs focus"}</th>
              </tr>
            </thead>
            <tbody>
              {(ov?.members ?? []).map((m) => (
                <tr key={m.uid} className="border-b border-bca-rule/60">
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full overflow-hidden border border-bca-rule bg-bca-navy grid place-items-center shrink-0">
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
                        <div className="font-semibold text-bca-ink truncate">{m.name}</div>
                        <div className="text-[11px] text-bca-mute truncate">{m.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-bca-ink">{m.level}</td>
                  <td className="py-2.5 px-3 font-semibold text-bca-navy">{m.total_xp}</td>
                  <td className="py-2.5 px-3 text-bca-ink">{m.total_sessions}</td>
                  <td className="py-2.5 px-3 text-bca-mute">
                    {m.weakest_dimension ? dimLabel(m.weakest_dimension) : "—"}
                  </td>
                </tr>
              ))}
              {(ov?.members ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-bca-mute">
                    {lang === "id" ? "Belum ada data latihan." : "No training data yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </main>
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
}: {
  label: string;
  value?: number;
  text?: string;
  suffix?: string;
}) {
  return (
    <div className="surface-paper rounded-[16px] shadow-soft p-4">
      <div className="text-[11px] uppercase tracking-wide text-bca-mute font-semibold">{label}</div>
      <div className="mt-1 font-serif text-bca-ink text-[26px]" style={{ fontWeight: 500 }}>
        {text ?? value}
        {suffix && <span className="text-[14px] text-bca-mute font-sans">{suffix}</span>}
      </div>
    </div>
  );
}
