export type Persona = {
  id: string;
  name: string;
  title: string;
  summary: string;
  challenge: string;
  accent: string;
};

// Difficulty → dot/label colour, so the list reads at a glance.
const CHALLENGE_COLOR: Record<string, string> = {
  Mudah: "#1E7B47",
  Easy: "#1E7B47",
  Sedang: "#2E86C1",
  Medium: "#2E86C1",
  Sulit: "#E0533D",
  Hard: "#E0533D",
};

export function PersonaCard({
  persona,
  selected,
  onSelect,
  challengeLabel,
  active,
}: {
  persona: Persona;
  selected: boolean;
  onSelect: (p: Persona) => void;
  challengeLabel: string;
  active?: boolean;
}) {
  const isActive = !!active || selected;
  const diffColor = CHALLENGE_COLOR[persona.challenge] ?? "#C8941E";
  return (
    <button
      onClick={() => onSelect(persona)}
      title={`${persona.title} — ${persona.summary} (${challengeLabel}: ${persona.challenge})`}
      aria-pressed={isActive}
      className={`group w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-xl border transition ${
        isActive
          ? "bg-white/10 border-bca-accentGold/70"
          : "bg-transparent border-transparent hover:bg-white/5"
      }`}
    >
      <div
        className="shrink-0 rounded-full grid place-items-center font-serif text-white"
        style={{
          width: 32,
          height: 32,
          background: `radial-gradient(120% 120% at 30% 25%, ${lighten(
            persona.accent,
          )} 0%, ${persona.accent} 55%, ${darken(persona.accent)} 100%)`,
          fontSize: 14,
          fontStyle: "italic",
          boxShadow: isActive
            ? "0 0 0 2px rgba(245,197,24,0.7)"
            : "inset 0 1px 0 rgba(255,255,255,0.25)",
        }}
      >
        {persona.name.charAt(0)}
      </div>

      <span className="flex-1 min-w-0 text-[13px] font-semibold text-white/90 truncate">
        {persona.name}
      </span>

      <span className="shrink-0 inline-flex items-center gap-1.5">
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: diffColor }}
        />
        <span
          className="text-[10px] uppercase tracking-[0.1em] font-semibold"
          style={{ color: diffColor }}
        >
          {persona.challenge}
        </span>
      </span>
    </button>
  );
}

function lighten(hex: string): string {
  return mix(hex, "#FFFFFF", 0.35);
}
function darken(hex: string): string {
  return mix(hex, "#000000", 0.45);
}
function mix(a: string, b: string, t: number): string {
  const pa = parse(a);
  const pb = parse(b);
  const r = Math.round(pa[0] * (1 - t) + pb[0] * t);
  const g = Math.round(pa[1] * (1 - t) + pb[1] * t);
  const bl = Math.round(pa[2] * (1 - t) + pb[2] * t);
  return `rgb(${r},${g},${bl})`;
}
function parse(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  return [
    parseInt(m.slice(0, 2), 16),
    parseInt(m.slice(2, 4), 16),
    parseInt(m.slice(4, 6), 16),
  ];
}
