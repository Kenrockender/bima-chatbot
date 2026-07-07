import { useState } from "react";
import type { Persona } from "./PersonaCard";

export type Scores = {
  rapport: number;
  discovery: number;
  product_knowledge: number;
  objection_handling: number;
  closing: number;
};

export type Badge = { id: string; name: string; description: string };

export type Progress = {
  xp_earned: number;
  streak: number;
  level: number;
  total_sessions: number;
  new_badges: Badge[];
};

export type ModuleResult = {
  id: string;
  title: string;
  dimension: string;
  passed: boolean;
  gate: { dimension: string; min_score: number; overall_min: number | null };
};

export type Report = {
  persona: Persona;
  scores: Scores;
  overall_score: number;
  strengths: string[];
  improvements: string[];
  next_focus: string;
  turn_count: number;
  progress?: Progress;
  module?: ModuleResult;
  raw?: string;
  eval_failed?: boolean;
};

export function FeedbackReport({
  report,
  onTryAgain,
  recommendedPersonaId,
  onPractice,
  labels,
}: {
  report: Report;
  onTryAgain: () => void;
  recommendedPersonaId?: string;
  onPractice?: (personaId: string) => void;
  labels: {
    eyebrow: string;
    title: string;
    overall: string;
    scores: string;
    strengths: string;
    improvements: string;
    next: string;
    turns: string;
    tryAgain: string;
    rapport: string;
    discovery: string;
    product_knowledge: string;
    objection_handling: string;
    closing: string;
    xpEarned: string;
    streak: string;
    newBadge: string;
    level: string;
    practiceWeakest: string;
    saved: string;
    copyReport: string;
    downloadReport: string;
    reportCopied: string;
    moduleMastered: string;
    moduleUnlockedNext: string;
    moduleKeepGoing: string;
    modulePassNeed: string;
  };
}) {
  const prog = report.progress;
  const [copied, setCopied] = useState(false);
  const dims: { key: keyof Scores; label: string }[] = [
    { key: "rapport", label: labels.rapport },
    { key: "discovery", label: labels.discovery },
    { key: "product_knowledge", label: labels.product_knowledge },
    { key: "objection_handling", label: labels.objection_handling },
    { key: "closing", label: labels.closing },
  ];

  // Plain-text/markdown summary an FA can paste into WhatsApp/email to their
  // manager, or keep as a record. Built from the same report the UI renders.
  function buildSummary(): string {
    const line = "──────────────────────────";
    const out: string[] = [];
    out.push(`${labels.eyebrow} · BIMA`);
    out.push(line);
    out.push(`${labels.overall}: ${report.overall_score}/10`);
    out.push(
      `${report.persona.name} · ${report.turn_count} ${labels.turns} · ${new Date().toLocaleString()}`,
    );
    out.push("");
    out.push(`${labels.scores}:`);
    for (const d of dims) out.push(`  • ${d.label}: ${report.scores[d.key] ?? 0}/10`);
    if (report.strengths.length) {
      out.push("");
      out.push(`${labels.strengths}:`);
      for (const s of report.strengths) out.push(`  • ${s}`);
    }
    if (report.improvements.length) {
      out.push("");
      out.push(`${labels.improvements}:`);
      for (const s of report.improvements) out.push(`  • ${s}`);
    }
    if (report.next_focus) {
      out.push("");
      out.push(`${labels.next}: ${report.next_focus}`);
    }
    return out.join("\n");
  }

  async function copySummary() {
    const text = buildSummary();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API can be blocked (insecure context) — fall back to a
      // hidden textarea + execCommand so the copy still works.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadSummary() {
    const blob = new Blob([buildSummary()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `bima-report-${report.persona.name.replace(/\s+/g, "-").toLowerCase()}-${stamp}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="animate-riseIn space-y-6">
      <div className="flex items-center gap-3">
        <span className="block w-7 h-px bg-life-blue" />
        <span className="life-eyebrow">{labels.eyebrow}</span>
      </div>
      <h2
        className="font-sans font-extrabold text-life-heading text-[34px] sm:text-[42px] leading-[1.1] tracking-tight"
        style={{ letterSpacing: "-0.025em" }}
      >
        {labels.title}
      </h2>

      {/* Learning-path module outcome — celebrate mastery or nudge a retry */}
      {report.module && (
        report.module.passed ? (
          <div className="rounded-[16px] p-5 flex items-start gap-3.5 border border-life-teal/30 bg-life-blueBg/60 animate-fadeIn">
            <span className="text-[24px] shrink-0 leading-none mt-0.5" aria-hidden>🎉</span>
            <div className="min-w-0">
              <p className="font-sans font-extrabold text-life-heading text-[16px]">
                {labels.moduleMastered}
              </p>
              <p className="text-[13px] text-life-body mt-0.5 leading-relaxed">
                <span className="font-semibold text-life-heading">{report.module.title}</span>
                {" · "}
                {labels.moduleUnlockedNext}
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-[16px] p-5 flex items-start gap-3.5 border border-life-amber/40 bg-life-amberBg animate-fadeIn">
            <span className="text-[22px] shrink-0 leading-none mt-0.5" aria-hidden>💪</span>
            <div className="min-w-0">
              <p className="font-sans font-extrabold text-life-heading text-[15.5px]">
                {labels.moduleKeepGoing}
              </p>
              <p className="text-[13px] text-life-body mt-0.5 leading-relaxed">
                <span className="font-semibold text-life-heading">{report.module.title}</span>
                {" · "}
                {labels.modulePassNeed}:{" "}
                {(labels as Record<string, string>)[report.module.dimension] ?? report.module.dimension}
                {" ≥ "}
                {report.module.gate.min_score}
              </p>
            </div>
          </div>
        )
      )}

      {/* Session deltas — streak kept (XP & level retired) */}
      {prog && (
        <div className="flex flex-wrap items-center gap-2.5 animate-fadeIn">
          <span className="inline-flex items-center gap-1.5 rounded-full life-card px-3.5 py-1.5 text-[12.5px] text-life-heading/85 font-medium">
            🔥 {prog.streak} {labels.streak}
          </span>
          <span className="text-[11.5px] text-life-body italic ml-auto">
            {labels.saved}
          </span>
        </div>
      )}

      {/* Newly unlocked badges */}
      {prog && prog.new_badges.length > 0 && (
        <div className="flex flex-wrap gap-2.5 animate-fadeIn">
          {prog.new_badges.map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-2.5 rounded-[14px] p-3 pr-4 life-card card-tint-blue"
            >
              <span className="life-icon shrink-0" style={{ width: 34, height: 34, borderRadius: 999, fontSize: 16 }}>
                🏅
              </span>
              <div className="leading-tight">
                <div className="life-eyebrow text-[9.5px]">
                  {labels.newBadge}
                </div>
                <div className="font-sans font-bold text-life-heading text-[15px]">{b.name}</div>
                <div className="text-[11px] text-life-body">{b.description}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Eval failure banner */}
      {report.eval_failed && (
        <div className="rounded-[14px] p-5 flex items-start gap-3 border border-life-amber/40 bg-life-amberBg">
          <span className="text-[20px] shrink-0 mt-0.5" aria-hidden>⚠️</span>
          <div>
            <p className="text-[14px] font-semibold text-life-heading mb-1">
              Evaluasi gagal diproses
            </p>
            <p className="text-[13px] text-life-body leading-relaxed">
              Skor di bawah bukan penilaian asli — sistem tidak berhasil mengevaluasi sesi ini.
              Silakan klik &quot;Coba Lagi&quot; untuk mengakhiri sesi dan mendapatkan evaluasi ulang.
            </p>
          </div>
        </div>
      )}

      {/* Overall + persona reminder */}
      <div className="grid sm:grid-cols-[1fr_auto] gap-6 items-stretch">
        <div className="life-card p-7 relative overflow-hidden">
          <span
            aria-hidden
            className="absolute top-0 left-0 h-1 w-16"
            style={{ background: report.persona.accent }}
          />
          <div className="flex items-baseline gap-2 mb-2">
            <span className="life-eyebrow">{labels.overall}</span>
            <span className="h-px flex-1 max-w-[60px] bg-life-blue/15" />
          </div>
          <div className="flex items-baseline gap-3">
            <span
              className="font-sans font-extrabold text-life-heading text-[64px] leading-none"
              style={{ letterSpacing: "-0.04em" }}
            >
              {report.overall_score}
            </span>
            <span className="font-sans font-bold text-life-body text-[28px]">/ 10</span>
          </div>
          <p className="text-[13px] text-life-body mt-3">
            {report.turn_count} {labels.turns} · vs.{" "}
            <span className="text-life-heading/85 font-medium">
              {report.persona.name}
            </span>
          </p>
        </div>

        <div
          className="hidden sm:flex items-center justify-center rounded-[18px] life-card px-8 min-w-[180px]"
        >
          <div
            className="flex items-center justify-center rounded-full font-serif text-white"
            style={{
              width: 80,
              height: 80,
              background: `radial-gradient(120% 120% at 30% 25%, ${report.persona.accent} 0%, ${report.persona.accent} 60%, #001E3F 100%)`,
              fontSize: 36,
              fontStyle: "italic",
            }}
          >
            {report.persona.name.charAt(0)}
          </div>
        </div>
      </div>

      {/* Score bars */}
      <div className="life-card p-7">
        <div className="flex items-center gap-2 mb-5">
          <span className="life-eyebrow">{labels.scores}</span>
          <span className="h-px flex-1 max-w-[60px] bg-life-blue/15" />
        </div>
        <div className="space-y-4">
          {dims.map((d) => {
            const score = report.scores[d.key] ?? 0;
            return (
              <div key={d.key}>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-[13.5px] text-life-heading/85">
                    {d.label}
                  </span>
                  <span className="font-sans font-bold text-life-heading text-[15px] tabular-nums">
                    {score}
                    <span className="text-life-body text-[12px] font-normal"> / 10</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden bg-life-blue/[0.08]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(score / 10) * 100}%`,
                      background:
                        score >= 7
                          ? "linear-gradient(90deg, #0a55ab, #19b8a6)"
                          : score >= 4
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

      {/* Strengths + Improvements */}
      <div className="grid md:grid-cols-2 gap-5">
        <ListCard
          eyebrow={labels.strengths}
          accent="#1E7B47"
          items={report.strengths}
        />
        <ListCard
          eyebrow={labels.improvements}
          accent="#F9B233"
          items={report.improvements}
        />
      </div>

      {/* Next focus */}
      {report.next_focus && (
        <div
          className="rounded-[16px] p-6 relative overflow-hidden life-card card-tint-blue"
        >
          <span
            aria-hidden
            className="absolute top-0 left-0 h-1 w-12"
            style={{ background: "linear-gradient(90deg, #0a55ab, #19b8a6)" }}
          />
          <span className="life-eyebrow">{labels.next}</span>
          <p className="font-sans font-bold text-life-heading text-[20px] leading-snug mt-2">
            {report.next_focus}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {recommendedPersonaId && onPractice && (
          <button
            onClick={() => onPractice(recommendedPersonaId)}
            className="btn-life-amber"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-life-heading/70" />
            {labels.practiceWeakest}
          </button>
        )}
        <button
          onClick={onTryAgain}
          className="btn-life"
        >
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-life-amber" />
          {labels.tryAgain}
        </button>

        <button
          onClick={copySummary}
          aria-label={labels.copyReport}
          className="inline-flex items-center gap-2 text-[13px] font-semibold text-life-heading/85 bg-life-blue/[0.06] hover:bg-life-blue/[0.12] border border-life-blue/15 rounded-full px-4 py-2.5 transition"
        >
          {copied ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12" /></svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
          )}
          {copied ? labels.reportCopied : labels.copyReport}
        </button>

        <button
          onClick={downloadSummary}
          aria-label={labels.downloadReport}
          className="inline-flex items-center gap-2 text-[13px] font-semibold text-life-heading/85 bg-life-blue/[0.06] hover:bg-life-blue/[0.12] border border-life-blue/15 rounded-full px-4 py-2.5 transition"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>
          {labels.downloadReport}
        </button>
      </div>
    </div>
  );
}

function ListCard({
  eyebrow,
  accent,
  items,
}: {
  eyebrow: string;
  accent: string;
  items: string[];
}) {
  return (
    <div className="life-card p-7 relative overflow-hidden">
      <span
        aria-hidden
        className="absolute top-0 left-0 h-1 w-12"
        style={{ background: accent }}
      />
      <div className="flex items-center gap-2 mb-3">
        <span
          className="smallcaps"
          style={{ color: accent }}
        >
          {eyebrow}
        </span>
        <span className="h-px flex-1 max-w-[60px] bg-life-blue/15" />
      </div>
      {items.length === 0 ? (
        <p className="text-[13.5px] text-life-body italic">—</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-life-heading/85">
              <span
                aria-hidden
                className="inline-block w-1.5 h-1.5 rounded-full mt-2 shrink-0"
                style={{ background: accent }}
              />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
