/**
 * Shared line/solid SVG icons for the BCA Life theme — replaces the emoji that
 * were scattered through the UI. All take a className (color via currentColor)
 * and an optional size.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base(size: number, props: SVGProps<SVGSVGElement>) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

export function FlameIcon({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size, p)}>
      <path d="M12 2c1 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1 .3-1.7.6-2.3C7 9 6 10.5 6 13a6 6 0 0 0 12 0c0-4.5-3.5-7-6-11z" />
    </svg>
  );
}

export function TrophyIcon({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size, p)}>
      <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4z" />
      <path d="M7 6H5a2 2 0 0 0 0 4h2M17 6h2a2 2 0 0 1 0 4h-2" />
    </svg>
  );
}

export function MedalIcon({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size, p)}>
      <path d="M8.21 3 12 9l3.79-6" />
      <path d="M7 3h10" />
      <circle cx="12" cy="15" r="6" />
      <path d="M12 12.5l1 2 2 .2-1.5 1.4.4 2L12 17l-1.9 1.1.4-2L9 14.7l2-.2z" />
    </svg>
  );
}

export function TargetIcon({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size, p)}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CheckIcon({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size, p)}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function ClockIcon({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size, p)}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14" />
    </svg>
  );
}

export function WarningIcon({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size, p)}>
      <path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function SparkIcon({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size, p)}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
    </svg>
  );
}

/** Rank medal — a trophy/medal tinted by rank (1/2/3), with the number inside. */
export function RankMedal({ rank, size = 26 }: { rank: number; size?: number }) {
  const tint =
    rank === 1 ? "#F9B233" : rank === 2 ? "#9db8d6" : rank === 3 ? "#c98a4b" : "#cbd5e1";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M8.5 2.5 12 8l3.5-5.5" stroke={tint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="15" r="6.5" fill={tint} opacity="0.18" />
      <circle cx="12" cy="15" r="6.5" stroke={tint} strokeWidth="2" />
      <text x="12" y="15" dominantBaseline="central" textAnchor="middle" fontSize="7.5" fontWeight="800" fill={tint}>
        {rank}
      </text>
    </svg>
  );
}
