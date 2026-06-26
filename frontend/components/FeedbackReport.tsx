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

export type Report = {
  persona: Persona;
  scores: Scores;
  overall_score: number;
  strengths: string[];
  improvements: string[];
  next_focus: string;
  turn_count: number;
  progress?: Progress;
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
  };
}) {
  const prog = report.progress;
  const dims: { key: keyof Scores; label: string }[] = [
    { key: "rapport", label: labels.rapport },
    { key: "discovery", label: labels.discovery },
    { key: "product_knowledge", label: labels.product_knowledge },
    { key: "objection_handling", label: labels.objection_handling },
    { key: "closing", label: labels.closing },
  ];

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

      {/* Gamification deltas — XP / streak / level earned this session */}
      {prog && (
        <div className="flex flex-wrap items-center gap-2.5 animate-fadeIn">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-life-blue text-white px-3.5 py-1.5 text-[12.5px] font-semibold shadow-lifeBlue">
            <span className="w-1.5 h-1.5 rounded-full bg-life-amber" />
            +{prog.xp_earned} {labels.xpEarned}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full life-card px-3.5 py-1.5 text-[12.5px] text-life-heading/85 font-medium">
            🔥 {prog.streak} {labels.streak}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full life-card px-3.5 py-1.5 text-[12.5px] text-life-heading/85 font-medium">
            {labels.level} {prog.level}
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
        <div
          className="rounded-[14px] p-5 flex items-start gap-3"
          style={{
            background: "linear-gradient(150deg, #FFF8F0 0%, #FDEBD0 100%)",
            border: "1px solid #F0C27A",
          }}
        >
          <span className="text-[20px] shrink-0 mt-0.5">⚠️</span>
          <div>
            <p className="text-[14px] font-semibold text-bca-ink/90 mb-1">
              Evaluasi gagal diproses
            </p>
            <p className="text-[13px] text-bca-ink/70 leading-relaxed">
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
