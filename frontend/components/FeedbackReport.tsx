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
        <span className="block w-7 h-px bg-bca-gold" />
        <span className="smallcaps text-bca-gold">{labels.eyebrow}</span>
      </div>
      <h2
        className="font-serif text-bca-ink text-[36px] sm:text-[44px] leading-[1.1] tracking-tight"
        style={{ fontWeight: 400, letterSpacing: "-0.025em" }}
      >
        {labels.title}
      </h2>

      {/* Gamification deltas — XP / streak / level earned this session */}
      {prog && (
        <div className="flex flex-wrap items-center gap-2.5 animate-fadeIn">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-bca-navy text-bca-cream px-3.5 py-1.5 text-[12.5px] font-semibold shadow-soft">
            <span className="w-1.5 h-1.5 rounded-full bg-bca-gold" />
            +{prog.xp_earned} {labels.xpEarned}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full surface-paper shadow-paper px-3.5 py-1.5 text-[12.5px] text-bca-ink/85 font-medium">
            🔥 {prog.streak} {labels.streak}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full surface-paper shadow-paper px-3.5 py-1.5 text-[12.5px] text-bca-ink/85 font-medium">
            {labels.level} {prog.level}
          </span>
          <span className="text-[11.5px] text-bca-mute italic ml-auto">
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
              className="flex items-center gap-2.5 rounded-[14px] p-3 pr-4 shadow-paper"
              style={{
                background: "linear-gradient(150deg, #FDFBF6 0%, #F4ECDA 100%)",
                border: "1px solid #E6DFD0",
              }}
            >
              <span
                className="flex items-center justify-center rounded-full text-[16px] shrink-0"
                style={{ width: 34, height: 34, background: "#C8941E" }}
              >
                🏅
              </span>
              <div className="leading-tight">
                <div className="smallcaps text-bca-gold text-[9.5px]">
                  {labels.newBadge}
                </div>
                <div className="font-serif text-bca-ink text-[15px]">{b.name}</div>
                <div className="text-[11px] text-bca-mute">{b.description}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Overall + persona reminder */}
      <div className="grid sm:grid-cols-[1fr_auto] gap-6 items-stretch">
        <div className="surface-paper rounded-[18px] shadow-paper p-7 relative overflow-hidden">
          <span
            aria-hidden
            className="absolute top-0 left-0 h-1 w-16"
            style={{ background: report.persona.accent }}
          />
          <div className="flex items-baseline gap-2 mb-2">
            <span className="smallcaps text-bca-mute">{labels.overall}</span>
            <span className="h-px flex-1 max-w-[60px] bg-bca-rule" />
          </div>
          <div className="flex items-baseline gap-3">
            <span
              className="font-serif text-bca-ink text-[64px] leading-none"
              style={{ fontWeight: 400, letterSpacing: "-0.04em" }}
            >
              {report.overall_score}
            </span>
            <span className="font-serif text-bca-mute text-[28px]">/ 10</span>
          </div>
          <p className="text-[13px] text-bca-mute mt-3">
            {report.turn_count} {labels.turns} · vs.{" "}
            <span className="text-bca-ink/85 font-medium">
              {report.persona.name}
            </span>
          </p>
        </div>

        <div
          className="hidden sm:flex items-center justify-center rounded-[18px] surface-paper shadow-paper px-8 min-w-[180px]"
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
      <div className="surface-paper rounded-[18px] shadow-paper p-7">
        <div className="flex items-center gap-2 mb-5">
          <span className="smallcaps text-bca-navy">{labels.scores}</span>
          <span className="h-px flex-1 max-w-[60px] bg-bca-rule" />
        </div>
        <div className="space-y-4">
          {dims.map((d) => {
            const score = report.scores[d.key] ?? 0;
            return (
              <div key={d.key}>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-[13.5px] text-bca-ink/85">
                    {d.label}
                  </span>
                  <span className="font-serif text-bca-ink text-[15px] tabular-nums">
                    {score}
                    <span className="text-bca-mute text-[12px]"> / 10</span>
                  </span>
                </div>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ background: "rgba(10, 27, 46, 0.06)" }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(score / 10) * 100}%`,
                      background:
                        score >= 7
                          ? "linear-gradient(90deg, #C8941E, #E6B85A)"
                          : score >= 4
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

      {/* Strengths + Improvements */}
      <div className="grid md:grid-cols-2 gap-5">
        <ListCard
          eyebrow={labels.strengths}
          accent="#1E7B47"
          items={report.strengths}
        />
        <ListCard
          eyebrow={labels.improvements}
          accent="#C8941E"
          items={report.improvements}
        />
      </div>

      {/* Next focus */}
      {report.next_focus && (
        <div
          className="rounded-[18px] p-6 shadow-paper relative overflow-hidden"
          style={{
            background: "linear-gradient(150deg, #FDFBF6 0%, #F4ECDA 100%)",
            border: "1px solid #E6DFD0",
          }}
        >
          <span
            aria-hidden
            className="absolute top-0 left-0 h-1 w-12"
            style={{ background: "#C8941E" }}
          />
          <span className="smallcaps text-bca-gold">{labels.next}</span>
          <p className="font-serif text-bca-ink text-[20px] leading-snug mt-2">
            {report.next_focus}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {recommendedPersonaId && onPractice && (
          <button
            onClick={() => onPractice(recommendedPersonaId)}
            className="inline-flex items-center gap-2 bg-bca-gold hover:brightness-95 transition text-bca-ink text-[14px] font-semibold rounded-full px-6 py-3 shadow-soft"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-bca-ink/70" />
            {labels.practiceWeakest}
          </button>
        )}
        <button
          onClick={onTryAgain}
          className="inline-flex items-center gap-2 bg-bca-navy hover:bg-bca-ink transition text-bca-cream text-[14px] font-medium rounded-full px-6 py-3 shadow-soft group"
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: "#C8941E" }}
          />
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
    <div className="surface-paper rounded-[18px] shadow-paper p-7 relative overflow-hidden">
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
        <span className="h-px flex-1 max-w-[60px] bg-bca-rule" />
      </div>
      {items.length === 0 ? (
        <p className="text-[13.5px] text-bca-mute italic">—</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-bca-ink/85">
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
