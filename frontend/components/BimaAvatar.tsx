export function BimaAvatar({
  size = 36,
  withPulse = false,
}: {
  size?: number;
  withPulse?: boolean;
}) {
  return (
    <div
      style={{ width: size, height: size }}
      className="relative inline-flex items-center justify-center shrink-0"
      aria-label="BIMA avatar"
    >
      {withPulse && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-[28%] bg-bca-yellow/40 animate-pulseRing"
        />
      )}
      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        className="relative z-10 drop-shadow-xs"
        aria-hidden
      >
        <defs>
          <linearGradient id="bimaAvTeal" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#9FE3DE" />
            <stop offset="55%" stopColor="#5FC5C0" />
            <stop offset="100%" stopColor="#3FAFAA" />
          </linearGradient>
          <radialGradient id="bimaAvShine" cx="35%" cy="25%" r="70%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Rounded teal tile */}
        <rect x="0" y="0" width="200" height="200" rx="40" ry="40" fill="url(#bimaAvTeal)" />
        <rect x="0" y="0" width="200" height="200" rx="40" ry="40" fill="url(#bimaAvShine)" />
        <rect
          x="0"
          y="0"
          width="200"
          height="200"
          rx="40"
          ry="40"
          fill="none"
          stroke="#1B3F7A"
          strokeWidth="2.5"
          strokeOpacity="0.18"
        />

        {/* Antenna */}
        <line x1="100" y1="38" x2="100" y2="26" stroke="#1B3F7A" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="100" cy="22" r="5" fill="#1B3F7A" />

        {/* Headphones */}
        <ellipse cx="40" cy="90" rx="14" ry="17" fill="#1B3F7A" />
        <ellipse cx="40" cy="90" rx="7" ry="10" fill="#3FAFAA" />
        <ellipse cx="160" cy="90" rx="14" ry="17" fill="#1B3F7A" />
        <ellipse cx="160" cy="90" rx="7" ry="10" fill="#3FAFAA" />

        {/* Headband */}
        <path d="M40 78 Q100 40 160 78" fill="none" stroke="#1B3F7A" strokeWidth="4" strokeLinecap="round" />

        {/* Head */}
        <rect x="42" y="50" width="116" height="92" rx="34" ry="34" fill="#ffffff" stroke="#1B3F7A" strokeWidth="3" />

        {/* Eyes */}
        <path d="M72 94 q9 -12 18 0" fill="none" stroke="#1B3F7A" strokeWidth="5" strokeLinecap="round" />
        <path d="M110 94 q9 -12 18 0" fill="none" stroke="#1B3F7A" strokeWidth="5" strokeLinecap="round" />

        {/* Blush */}
        <circle cx="64" cy="110" r="5" fill="#F8B4B4" opacity="0.75" />
        <circle cx="136" cy="110" r="5" fill="#F8B4B4" opacity="0.75" />

        {/* Smile */}
        <path d="M84 118 q16 14 32 0" fill="none" stroke="#1B3F7A" strokeWidth="4" strokeLinecap="round" />

        {/* Body bubbles */}
        <path
          d="M55 155 q0 -14 14 -14 h28 q14 0 14 14 v18 q0 14 -14 14 h-6 l-10 10 v-10 h-12 q-14 0 -14 -14 z"
          fill="#ffffff"
          stroke="#1B3F7A"
          strokeWidth="3"
        />
        <path
          d="M98 165 q0 -14 14 -14 h22 q14 0 14 14 v14 q0 14 -14 14 h-22 q-14 0 -14 -14 z"
          fill="#ffffff"
          stroke="#1B3F7A"
          strokeWidth="3"
        />
      </svg>
    </div>
  );
}
