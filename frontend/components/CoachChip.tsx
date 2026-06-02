export type Coach = {
  verdict: "good" | "watch" | "tip";
  dimension?: string | null;
  note: string;
};

const STYLES: Record<
  Coach["verdict"],
  { dot: string; text: string; bg: string; border: string }
> = {
  good: {
    dot: "#1E7B47",
    text: "#1E7B47",
    bg: "rgba(30,123,71,0.07)",
    border: "rgba(30,123,71,0.25)",
  },
  watch: {
    dot: "#B23A3A",
    text: "#A33232",
    bg: "rgba(178,58,58,0.07)",
    border: "rgba(178,58,58,0.25)",
  },
  tip: {
    dot: "#C8941E",
    text: "#9A7016",
    bg: "rgba(200,148,30,0.08)",
    border: "rgba(200,148,30,0.28)",
  },
};

/**
 * Live, per-turn micro-feedback shown under the advisor's message — the
 * signature "Stimuler" instant-coaching beat.
 */
export function CoachChip({ coach, label }: { coach: Coach; label: string }) {
  const s = STYLES[coach.verdict] ?? STYLES.tip;
  return (
    <div className="flex justify-end mb-4 -mt-2 animate-fadeIn">
      <div
        className="inline-flex items-start gap-2 max-w-[80%] rounded-2xl px-3 py-2"
        style={{ background: s.bg, border: `1px solid ${s.border}` }}
      >
        <span
          aria-hidden
          className="inline-block w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
          style={{ background: s.dot }}
        />
        <span className="text-[12px] leading-snug" style={{ color: s.text }}>
          <span className="uppercase tracking-[0.12em] font-bold text-[9.5px] mr-1.5 opacity-70">
            {label}
          </span>
          {coach.note}
        </span>
      </div>
    </div>
  );
}
