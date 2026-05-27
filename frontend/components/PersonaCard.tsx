export type Persona = {
  id: string;
  name: string;
  title: string;
  summary: string;
  challenge: string;
  accent: string;
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
  return (
    <button
      onClick={() => onSelect(persona)}
      className={`tile-persona w-full text-left p-3.5 flex items-center gap-3 ${
        isActive ? "is-active" : ""
      }`}
      aria-pressed={isActive}
    >
      <div className="relative shrink-0">
        <div
          className="rounded-full flex items-center justify-center font-serif text-white"
          style={{
            width: 52,
            height: 52,
            background: `radial-gradient(120% 120% at 30% 25%, ${lighten(
              persona.accent,
            )} 0%, ${persona.accent} 55%, ${darken(persona.accent)} 100%)`,
            fontSize: 22,
            fontStyle: "italic",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.25), 0 6px 14px -6px rgba(0,0,0,0.55)",
          }}
        >
          {persona.name.charAt(0)}
        </div>
        {isActive && (
          <span
            aria-hidden
            className="absolute -inset-0.5 rounded-full pointer-events-none"
            style={{ boxShadow: "0 0 0 2px rgba(245,197,24,0.7)" }}
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[14px] font-semibold text-white truncate">
            {persona.name}
          </div>
          <span
            className={`wave-glyph ${isActive ? "live" : ""}`}
            aria-hidden
          >
            <span /><span /><span /><span /><span /><span />
          </span>
        </div>
        <div className="text-[11.5px] text-white/55 truncate mt-0.5">
          {persona.title}
        </div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-bca-accentGold/80 mt-1">
          {challengeLabel}: {persona.challenge}
        </div>
      </div>
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
