"use client";

import { useState } from "react";
import Link from "next/link";
import { BimaAvatar } from "@/components/BimaAvatar";
import { authedFetch } from "@/lib/api";
import { t, type Lang } from "@/lib/i18n";

type Profile = {
  name?: string;
  age: number | "";
  gender: string;
  marital?: string;
  dependents?: number | "";
  income_per_month?: number | "";
  health_notes?: string;
  budget_premium_per_month?: number | "";
  goal?: string;
  horizon_years?: number | "";
  notes?: string;
};

type Recommendation = {
  product_name: string;
  fit_score: number;
  suggested_up: string;
  suggested_premium: string;
  suggested_tenor: string;
  rationale: string[];
  concerns: string[];
};

type Response = {
  customer_summary: string;
  recommendations: Recommendation[];
  error?: string;
  raw?: string;
  profile_echo?: Profile;
};

const EMPTY: Profile = {
  name: "",
  age: "",
  gender: "laki-laki",
  marital: "menikah",
  dependents: "",
  income_per_month: "",
  health_notes: "",
  budget_premium_per_month: "",
  goal: "proteksi keluarga",
  horizon_years: "",
  notes: "",
};

export default function RecommendPage() {
  const [lang, setLang] = useState<Lang>("id");
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Response | null>(null);
  const tr = t[lang];

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setResult(null);
    try {
      const payload: any = { ...profile };
      // Drop empty optional fields
      Object.keys(payload).forEach((k) => {
        if (payload[k] === "" || payload[k] === null || payload[k] === undefined) {
          delete payload[k];
        }
      });
      const res = await authedFetch("/api/recommender/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Request failed");
      const data: Response = await res.json();
      setResult(data);
    } catch {
      setResult({
        customer_summary: "",
        recommendations: [],
        error:
          lang === "id"
            ? "Gagal mengambil rekomendasi. Pastikan service jalan & coba lagi."
            : "Failed to fetch recommendation. Make sure the service is up.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setProfile(EMPTY);
    setResult(null);
  }

  return (
    <main className="min-h-screen bg-canvas relative overflow-hidden">
      <span className="watermark-b">B</span>

      {/* Header */}
      <header className="relative z-10 border-b border-bca-rule/70 bg-bca-cream/70 backdrop-blur-md">
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
                    {tr.recoEyebrow}
                  </span>
                </div>
                <p className="text-[12.5px] text-bca-mute mt-1 tracking-wide">
                  BCA Life · Advisor Cockpit
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div
                className="inline-flex items-center rounded-full p-1 text-[11.5px] font-semibold"
                style={{
                  background: "#FDFBF6",
                  border: "1px solid #E6DFD0",
                  letterSpacing: "0.08em",
                }}
              >
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
                href="/admin"
                className="text-[12px] smallcaps text-bca-mute hover:text-bca-navy px-2 py-1 transition"
              >
                {tr.admin}
              </Link>
            </div>
          </div>
          <div className="gold-rule mt-4" />
        </div>
      </header>

      <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-8 py-10">
        {/* Title section */}
        <div className="animate-riseIn mb-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="block w-7 h-px bg-bca-gold" />
            <span className="smallcaps text-bca-gold">{tr.recoEyebrow}</span>
          </div>
          <h2
            className="font-serif text-bca-ink text-[36px] sm:text-[44px] leading-[1.1] tracking-tight mb-4"
            style={{ fontWeight: 400, letterSpacing: "-0.025em" }}
          >
            {tr.recoTitle}
          </h2>
          <p className="text-[15px] text-bca-ink/75 max-w-2xl leading-relaxed">
            {tr.recoSubtitle}
          </p>
        </div>

        <div className="grid lg:grid-cols-[420px_1fr] gap-8">
          {/* ─────────── Form ─────────── */}
          <form
            onSubmit={submit}
            className="surface-paper rounded-[18px] shadow-paper p-7 relative overflow-hidden h-fit animate-riseIn"
            style={{ animationDelay: "120ms" }}
          >
            <span
              aria-hidden
              className="absolute top-0 left-0 h-1 w-16"
              style={{ background: "#003D7A" }}
            />
            <div className="flex items-center gap-2 mb-5">
              <span className="smallcaps text-bca-navy">{tr.recoFormTitle}</span>
              <span className="h-px flex-1 max-w-[60px] bg-bca-rule" />
            </div>

            <Field label={tr.fieldName}>
              <input
                type="text"
                value={profile.name || ""}
                onChange={(e) => set("name", e.target.value)}
                placeholder="—"
                className="form-input"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={tr.fieldAge} required>
                <input
                  type="number"
                  min={0}
                  max={120}
                  required
                  value={profile.age}
                  onChange={(e) =>
                    set("age", e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className="form-input"
                />
              </Field>
              <Field label={tr.fieldGender} required>
                <select
                  required
                  value={profile.gender}
                  onChange={(e) => set("gender", e.target.value)}
                  className="form-input"
                >
                  <option value="laki-laki">{tr.fieldGenderM}</option>
                  <option value="perempuan">{tr.fieldGenderF}</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={tr.fieldMarital}>
                <select
                  value={profile.marital || ""}
                  onChange={(e) => set("marital", e.target.value)}
                  className="form-input"
                >
                  <option value="lajang">{tr.maritalSingle}</option>
                  <option value="menikah">{tr.maritalMarried}</option>
                  <option value="cerai">{tr.maritalDivorced}</option>
                  <option value="janda/duda">{tr.maritalWidowed}</option>
                </select>
              </Field>
              <Field label={tr.fieldDependents}>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={profile.dependents ?? ""}
                  onChange={(e) =>
                    set(
                      "dependents",
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  className="form-input"
                />
              </Field>
            </div>

            <Field label={tr.fieldIncome}>
              <input
                type="number"
                min={0}
                step={0.5}
                value={profile.income_per_month ?? ""}
                onChange={(e) =>
                  set(
                    "income_per_month",
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                placeholder="mis. 15"
                className="form-input"
              />
            </Field>

            <Field label={tr.fieldBudget}>
              <input
                type="number"
                min={0}
                step={0.1}
                value={profile.budget_premium_per_month ?? ""}
                onChange={(e) =>
                  set(
                    "budget_premium_per_month",
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                placeholder="mis. 1.5"
                className="form-input"
              />
            </Field>

            <Field label={tr.fieldHealth}>
              <input
                type="text"
                value={profile.health_notes || ""}
                onChange={(e) => set("health_notes", e.target.value)}
                placeholder={tr.fieldHealthPh}
                className="form-input"
              />
            </Field>

            <div className="grid grid-cols-[1fr_auto] gap-3">
              <Field label={tr.fieldGoal}>
                <select
                  value={profile.goal || ""}
                  onChange={(e) => set("goal", e.target.value)}
                  className="form-input"
                >
                  <option value="proteksi keluarga">{tr.goalProtection}</option>
                  <option value="dana pendidikan anak">{tr.goalEducation}</option>
                  <option value="legacy planning / warisan">{tr.goalLegacy}</option>
                  <option value="investasi jangka panjang">{tr.goalInvestment}</option>
                  <option value="proteksi kesehatan">{tr.goalHealth}</option>
                </select>
              </Field>
              <Field label={tr.fieldHorizon}>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={profile.horizon_years ?? ""}
                  onChange={(e) =>
                    set(
                      "horizon_years",
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  placeholder="15"
                  className="form-input w-[88px]"
                />
              </Field>
            </div>

            <Field label={tr.fieldNotes}>
              <textarea
                rows={2}
                value={profile.notes || ""}
                onChange={(e) => set("notes", e.target.value)}
                placeholder={tr.fieldNotesPh}
                className="form-input resize-none"
              />
            </Field>

            <div className="flex items-center gap-2 mt-6">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-bca-navy hover:bg-bca-ink transition text-bca-cream text-[14px] font-medium rounded-full py-2.5 shadow-soft disabled:opacity-60"
              >
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: "#C8941E" }}
                />
                {submitting ? tr.submitting : tr.submitReco}
              </button>
              <button
                type="button"
                onClick={reset}
                className="text-[12px] smallcaps text-bca-mute hover:text-bca-navy px-3 py-2 rounded-full border border-bca-rule bg-bca-paper hover:border-bca-gold transition"
              >
                {tr.resetForm}
              </button>
            </div>

            <style jsx>{`
              :global(.form-input) {
                width: 100%;
                background: #ffffff;
                border: 1px solid #e6dfd0;
                border-radius: 10px;
                padding: 0.55rem 0.75rem;
                font-size: 14px;
                color: #0a1b2e;
                transition: border-color 0.15s, box-shadow 0.15s;
              }
              :global(.form-input::placeholder) {
                color: #7a8699;
              }
              :global(.form-input:focus) {
                outline: none;
                border-color: #c8941e;
                box-shadow: 0 0 0 4px rgba(200, 148, 30, 0.18);
              }
            `}</style>
          </form>

          {/* ─────────── Results pane ─────────── */}
          <div className="min-h-[400px]">
            {submitting && (
              <div className="surface-paper rounded-[18px] shadow-paper p-14 flex flex-col items-center justify-center animate-fadeIn">
                <div className="flex gap-2 mb-4">
                  {[0, 200, 400].map((d) => (
                    <span
                      key={d}
                      className="w-2.5 h-2.5 rounded-full"
                      style={{
                        background: "#C8941E",
                        animation: "blink 1.4s ease-in-out infinite",
                        animationDelay: `${d}ms`,
                      }}
                    />
                  ))}
                </div>
                <p className="font-serif text-bca-ink text-[18px] italic">
                  {tr.submitting}
                </p>
                <p className="text-[12px] smallcaps text-bca-mute mt-3">
                  ~ 20 – 40 detik
                </p>
              </div>
            )}

            {!submitting && !result && (
              <div className="surface-paper rounded-[18px] shadow-paper p-12 text-center animate-fadeIn">
                <div className="font-serif text-bca-ink text-[22px] mb-2 italic">
                  Belum ada rekomendasi.
                </div>
                <p className="text-[14px] text-bca-mute">
                  Lengkapi profil nasabah di kiri, lalu klik{" "}
                  <span className="text-bca-navy font-medium">
                    {tr.submitReco}
                  </span>
                  .
                </p>
              </div>
            )}

            {!submitting && result && (
              <ResultsPanel
                result={result}
                tr={tr}
                onScript={(rec) => {
                  // Save context for #2 — script generator. Not yet built; placeholder.
                  alert(
                    "Skrip jualan personalisasi akan dibangun di langkah berikutnya. Untuk sekarang, latihan dengan persona di /",
                  );
                }}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block mb-3">
      <span className="smallcaps text-bca-mute block mb-1.5">
        {label}
        {required && <span className="text-bca-gold ml-1">*</span>}
      </span>
      {children}
    </label>
  );
}

function ResultsPanel({
  result,
  tr,
  onScript,
}: {
  result: Response;
  tr: any;
  onScript: (rec: Recommendation) => void;
}) {
  if (result.error) {
    return (
      <div className="surface-paper rounded-[18px] shadow-paper p-8 animate-fadeIn">
        <div className="flex items-center gap-2 mb-2">
          <span className="smallcaps text-red-700">Error</span>
          <span className="h-px flex-1 max-w-[60px] bg-bca-rule" />
        </div>
        <p className="text-[14px] text-bca-ink/85">{result.error}</p>
        {result.raw && (
          <details className="mt-3 text-[12px] text-bca-mute">
            <summary className="cursor-pointer">Raw output</summary>
            <pre className="whitespace-pre-wrap mt-2 p-2 bg-bca-cream rounded">
              {result.raw}
            </pre>
          </details>
        )}
      </div>
    );
  }

  const recs = result.recommendations;
  if (recs.length === 0) {
    return (
      <div className="surface-paper rounded-[18px] shadow-paper p-12 text-center animate-fadeIn">
        <p className="font-serif text-bca-ink text-[18px] italic mb-2">
          Tidak ada produk yang ditemukan.
        </p>
        <p className="text-[13px] text-bca-mute">{tr.noProductsErr}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="surface-paper rounded-[18px] shadow-paper p-6 relative overflow-hidden">
        <span
          aria-hidden
          className="absolute top-0 left-0 h-1 w-16"
          style={{ background: "#C8941E" }}
        />
        <div className="flex items-center gap-2 mb-2">
          <span className="smallcaps text-bca-gold">{tr.resultsEyebrow}</span>
          <span className="h-px flex-1 max-w-[60px] bg-bca-rule" />
        </div>
        <p className="font-serif text-bca-ink text-[18px] leading-snug italic">
          {result.customer_summary}
        </p>
      </div>

      {recs.map((rec, i) => (
        <RecommendationCard
          key={rec.product_name + i}
          rec={rec}
          rank={i}
          tr={tr}
          onScript={() => onScript(rec)}
        />
      ))}
    </div>
  );
}

function RecommendationCard({
  rec,
  rank,
  tr,
  onScript,
}: {
  rec: Recommendation;
  rank: number;
  tr: any;
  onScript: () => void;
}) {
  const isBest = rank === 0;
  const scorePct = (rec.fit_score / 10) * 100;
  const scoreColor =
    rec.fit_score >= 7
      ? "linear-gradient(90deg, #C8941E, #E6B85A)"
      : rec.fit_score >= 4
      ? "linear-gradient(90deg, #003D7A, #1B6FC9)"
      : "linear-gradient(90deg, #B23A3A, #D86B6B)";

  return (
    <div className="surface-paper rounded-[18px] shadow-paper p-7 relative overflow-hidden">
      <span
        aria-hidden
        className="absolute top-0 left-0 h-1 w-16"
        style={{ background: isBest ? "#C8941E" : "#003D7A" }}
      />
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <span
            className="smallcaps text-[10.5px] mb-1.5 block"
            style={{ color: isBest ? "#C8941E" : "#003D7A" }}
          >
            {isBest ? tr.bestMatch : `${tr.altOption} #${rank}`}
          </span>
          <h3
            className="font-serif text-bca-ink text-[24px] leading-tight"
            style={{ fontWeight: 500, letterSpacing: "-0.02em" }}
          >
            {rec.product_name}
          </h3>
        </div>
        <div className="text-right shrink-0">
          <span className="smallcaps text-bca-mute text-[10.5px]">
            {tr.fitScore}
          </span>
          <div className="flex items-baseline gap-1 justify-end">
            <span
              className="font-serif text-bca-ink text-[34px] leading-none"
              style={{ fontWeight: 500 }}
            >
              {rec.fit_score}
            </span>
            <span className="text-bca-mute text-[13px]">/ 10</span>
          </div>
        </div>
      </div>

      <div
        className="h-1.5 rounded-full overflow-hidden mb-5"
        style={{ background: "rgba(10, 27, 46, 0.06)" }}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${scorePct}%`, background: scoreColor }}
        />
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-5">
        <Stat label={tr.suggestedUP} value={rec.suggested_up} accent="#003D7A" />
        <Stat
          label={tr.suggestedPremium}
          value={rec.suggested_premium}
          accent="#C8941E"
        />
        <Stat
          label={tr.suggestedTenor}
          value={rec.suggested_tenor}
          accent="#1E7B47"
        />
      </div>

      {rec.rationale.length > 0 && (
        <div className="mb-4">
          <span className="smallcaps text-bca-navy text-[10.5px] block mb-2">
            {tr.whyFit}
          </span>
          <ul className="space-y-2">
            {rec.rationale.map((r, i) => (
              <li
                key={i}
                className="flex gap-2.5 text-[14px] text-bca-ink/85 leading-relaxed"
              >
                <span
                  aria-hidden
                  className="w-1.5 h-1.5 rounded-full mt-2 shrink-0 bg-bca-gold"
                />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {rec.concerns.length > 0 && (
        <div className="mb-5">
          <span className="smallcaps text-[10.5px] block mb-2 text-red-700/90">
            {tr.concernsLabel}
          </span>
          <ul className="space-y-2">
            {rec.concerns.map((c, i) => (
              <li
                key={i}
                className="flex gap-2.5 text-[14px] text-bca-ink/85 leading-relaxed"
              >
                <span
                  aria-hidden
                  className="w-1.5 h-1.5 rounded-full mt-2 shrink-0"
                  style={{ background: "#B23A3A" }}
                />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isBest && (
        <button
          onClick={onScript}
          className="inline-flex items-center gap-2 bg-bca-navy hover:bg-bca-ink transition text-bca-cream text-[14px] font-medium rounded-full px-5 py-2.5 shadow-soft"
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: "#C8941E" }}
          />
          {tr.generateScript}
        </button>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      className="rounded-[12px] p-3"
      style={{
        background: "linear-gradient(150deg, #FDFBF6 0%, #F4ECDA 100%)",
        border: "1px solid #E6DFD0",
      }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className="w-1 h-1 rounded-full"
          style={{ background: accent }}
        />
        <span className="smallcaps text-bca-mute text-[10px]">{label}</span>
      </div>
      <div
        className="font-serif text-bca-ink text-[15px] leading-tight"
        style={{ fontWeight: 500 }}
      >
        {value}
      </div>
    </div>
  );
}
