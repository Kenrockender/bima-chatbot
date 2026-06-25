import { BimaAvatar } from "@/components/BimaAvatar";
import { AppNav, type NavKey } from "@/components/AppNav";
import { type Lang } from "@/lib/i18n";

/**
 * Shared BCA Life page header — brand lockup on the left, AppNav on the right,
 * a blue→teal hairline beneath. One component so every cockpit page's header is
 * pixel-identical. z-40 keeps the mobile nav dropdown above page content.
 */
export function PageHeader({
  eyebrow,
  tagline,
  lang,
  onLang,
  current,
}: {
  eyebrow: string;
  tagline: string;
  lang: Lang;
  onLang?: (l: Lang) => void;
  current: NavKey;
}) {
  return (
    <header className="relative z-40 border-b border-life-blue/10 bg-white/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 lg:px-8 pt-4 pb-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <BimaAvatar size={42} />
            <div className="leading-tight">
              <div className="flex items-baseline gap-2.5">
                <h1
                  className="font-sans text-life-heading text-[23px] leading-none font-extrabold tracking-tight"
                  style={{ letterSpacing: "-0.03em" }}
                >
                  BIMA
                </h1>
                <span className="life-eyebrow">{eyebrow}</span>
              </div>
              <p className="text-[12px] text-life-body mt-1 tracking-wide">
                {tagline}
              </p>
            </div>
          </div>

          <AppNav lang={lang} onLang={onLang} current={current} />
        </div>
      </div>
      <div className="h-[3px] life-gradient opacity-90" />
    </header>
  );
}
