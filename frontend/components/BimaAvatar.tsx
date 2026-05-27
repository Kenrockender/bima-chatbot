export function BimaAvatar({
  size = 36,
  withPulse = false,
}: {
  size?: number;
  withPulse?: boolean;
}) {
  const inner = size;
  return (
    <div
      style={{ width: size, height: size }}
      className="relative inline-flex items-center justify-center rounded-full shrink-0"
      aria-label="BIMA avatar"
    >
      {withPulse && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-bca-yellow/40 animate-pulseRing"
        />
      )}
      {/* Navy disc with subtle inner highlight */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(120% 120% at 30% 25%, #0066B3 0%, #003D7A 55%, #002854 100%)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -6px 12px rgba(0,0,0,0.22), 0 4px 10px -4px rgba(0,61,122,0.45)",
        }}
      />
      {/* Letter B */}
      <span
        className="relative z-10 text-white font-extrabold"
        style={{
          fontSize: inner * 0.46,
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        B
      </span>
      {/* BCA Life signature yellow dot */}
      <span
        className="absolute rounded-full"
        style={{
          width: Math.max(5, size * 0.22),
          height: Math.max(5, size * 0.22),
          bottom: 0,
          right: 0,
          background:
            "radial-gradient(circle at 30% 30%, #FFE680 0%, #FFD200 55%, #E5B800 100%)",
          boxShadow: "0 0 0 2px #FFFFFF, 0 2px 4px rgba(229,184,0,0.5)",
        }}
      />
    </div>
  );
}
