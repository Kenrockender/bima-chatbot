import type { ReactNode } from "react";

/**
 * BCA Life section header: an uppercase eyebrow, the navy dot+dash marker, and
 * the heading in Plus Jakarta Sans. One component so every page's titles line
 * up — part of the shared design system.
 */
export function SectionTitle({
  eyebrow,
  title,
  subtitle,
  size = "page",
  className = "",
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  size?: "page" | "card";
  className?: string;
}) {
  const isPage = size === "page";
  return (
    <div className={className}>
      {eyebrow && (
        <div className="life-marker mb-3">
          <span className="life-eyebrow">{eyebrow}</span>
        </div>
      )}
      <h2
        className={`font-sans text-life-heading tracking-tight ${
          isPage
            ? "text-[30px] sm:text-[38px] font-extrabold leading-[1.08]"
            : "text-[18px] font-extrabold"
        }`}
        style={{ letterSpacing: "-0.02em" }}
      >
        {title}
      </h2>
      {subtitle && (
        <p className="text-[14.5px] leading-[1.6] text-life-body mt-2.5 max-w-[620px]">
          {subtitle}
        </p>
      )}
    </div>
  );
}
