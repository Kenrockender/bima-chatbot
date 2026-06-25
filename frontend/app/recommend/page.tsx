"use client";

import { useState } from "react";
import { BimaAvatar } from "@/components/BimaAvatar";
import { AppNav } from "@/components/AppNav";
import { t, type Lang } from "@/lib/i18n";
import {
  PRODUCTS,
  type ProductComparison,
  type Competitor,
  type SalesScript,
} from "@/lib/productComparison";

// The customer-profile analysis flow is hidden for now (kept in git history at
// commit 4179c3d for easy restore). Flip to true to bring it back.
const SHOW_PROFILE_ANALYSIS = false;

export default function RecommendPage() {
  const [lang, setLang] = useState<Lang>("id");
  const [activeId, setActiveId] = useState<string>(PRODUCTS[0].id);
  const tr = t[lang];
  const product = PRODUCTS.find((p) => p.id === activeId) ?? PRODUCTS[0];

  return (
    <main className="min-h-screen bg-canvas relative overflow-hidden">
      <span className="watermark-b">B</span>

      {/* Header */}
      <header className="relative z-40 border-b border-bca-rule/70 bg-bca-cream/70 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 pt-5 pb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <BimaAvatar size={44} />
              <div className="leading-tight">
                <div className="flex items-baseline gap-2">
                  <h1
                    className="font-serif text-bca-ink text-[26px] leading-none tracking-tight"
                    style={{ fontWeight: 500, letterSpacing: "-0.02em" }}
                  >
                    BIMA
                  </h1>
                  <span className="smallcaps text-bca-gold">
                    {tr.compareEyebrow}
                  </span>
                </div>
                <p className="text-[12.5px] text-bca-mute mt-1 tracking-wide">
                  BCA Life · Advisor Cockpit
                </p>
              </div>
            </div>

            <AppNav lang={lang} onLang={setLang} current="recommend" />
          </div>
          <div className="gold-rule mt-4" />
        </div>
      </header>

      <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-8 py-10">
        {/* Title section */}
        <div className="animate-riseIn mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="block w-7 h-px bg-bca-gold" />
            <span className="smallcaps text-bca-gold">{tr.compareEyebrow}</span>
          </div>
          <h2
            className="font-serif text-bca-ink text-[36px] sm:text-[44px] leading-[1.1] tracking-tight mb-4"
            style={{ fontWeight: 400, letterSpacing: "-0.025em" }}
          >
            {tr.compareTitle}
          </h2>
          <p className="text-[15px] text-bca-ink/75 max-w-2xl leading-relaxed">
            {tr.compareSubtitle}
          </p>
          {SHOW_PROFILE_ANALYSIS && (
            <p className="text-[12px] text-bca-mute mt-3">{tr.recoSubtitle}</p>
          )}
        </div>

        {/* Product selector */}
        <div className="mb-8 animate-riseIn" style={{ animationDelay: "80ms" }}>
          <span className="smallcaps text-bca-mute block mb-2.5">
            {tr.selectProductLabel}
          </span>
          <div className="flex flex-wrap gap-2.5">
            {PRODUCTS.map((p) => {
              const active = p.id === activeId;
              return (
                <button
                  key={p.id}
                  onClick={() => setActiveId(p.id)}
                  className={`group inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13.5px] font-medium transition-all ${
                    active
                      ? "bg-bca-navy text-bca-cream shadow-soft"
                      : "bg-bca-paper text-bca-ink border border-bca-rule hover:border-bca-gold"
                  }`}
                >
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{ background: active ? "#C8941E" : "#9AA3B0" }}
                  />
                  {p.shortName}
                  {p.prototype && (
                    <span
                      className={`smallcaps text-[8.5px] px-1.5 py-0.5 rounded-full ${
                        active
                          ? "bg-bca-gold/25 text-bca-cream"
                          : "bg-bca-gold/15 text-bca-gold"
                      }`}
                    >
                      {tr.prototypeBadge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Comparison + script */}
        <ComparisonView key={product.id} product={product} tr={tr} />
      </div>
    </main>
  );
}

function ComparisonView({
  product,
  tr,
}: {
  product: ProductComparison;
  tr: any;
}) {
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Two-column: BCA Life vs Competitors */}
      <div className="grid lg:grid-cols-2 gap-5 items-start">
        {/* Column 1: BCA Life product */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: "#003D7A" }}
            />
            <span className="smallcaps text-bca-navy text-[11px] font-semibold">
              {tr.bcaLifeCol}
            </span>
            <span className="h-px flex-1 bg-bca-rule" />
          </div>
          <BCAProductCard product={product} tr={tr} />
        </div>

        {/* Column 2: head-to-head competitors */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: "#7A7A7A" }}
            />
            <span className="smallcaps text-bca-mute text-[11px] font-semibold">
              {tr.competitorCol}
            </span>
            <span className="h-px flex-1 bg-bca-rule" />
          </div>
          {product.competitors.map((comp, i) => (
            <CompetitorCard key={comp.productName + i} comp={comp} tr={tr} />
          ))}
        </div>
      </div>

      {/* Sales script */}
      {product.script ? (
        <SalesScriptPanel product={product} script={product.script} tr={tr} />
      ) : (
        <div className="surface-paper rounded-[18px] shadow-paper p-6 text-center">
          <p className="text-[13.5px] text-bca-mute italic">
            {tr.scriptInProgress}
          </p>
        </div>
      )}
    </div>
  );
}

function BCAProductCard({
  product,
  tr,
}: {
  product: ProductComparison;
  tr: any;
}) {
  return (
    <div className="surface-paper rounded-[18px] shadow-paper p-6 relative overflow-hidden">
      <span
        aria-hidden
        className="absolute top-0 left-0 h-1 w-16"
        style={{ background: "#C8941E" }}
      />
      <div className="mb-3">
        <span className="smallcaps text-[10px] text-bca-gold block mb-1">
          BCA Life
        </span>
        <h3
          className="font-serif text-bca-ink text-[22px] leading-tight"
          style={{ fontWeight: 500, letterSpacing: "-0.02em" }}
        >
          {product.name}
        </h3>
        <span className="text-[11.5px] text-bca-mute mt-1.5 block">
          {tr.productTypeLabel}: {product.type}
        </span>
      </div>

      <p className="text-[13.5px] text-bca-ink/80 leading-relaxed italic mb-4 pb-4 border-b border-bca-rule/70">
        {product.positioning}
      </p>

      <Section label={tr.featuresLabel} dot="#003D7A">
        <ul className="space-y-1.5">
          {product.features.map((f, i) => (
            <li
              key={i}
              className="flex gap-2 text-[13px] text-bca-ink/85 leading-relaxed"
            >
              <span
                aria-hidden
                className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                style={{ background: "#003D7A" }}
              />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section label={tr.strengthsHighlight} dot="#1E7B47">
        <ul className="space-y-1.5">
          {product.strengths.map((s, i) => (
            <li
              key={i}
              className="flex gap-2 text-[13px] text-bca-ink/85 leading-relaxed"
            >
              <span
                aria-hidden
                className="mt-0.5 shrink-0 text-[13px]"
                style={{ color: "#1E7B47" }}
              >
                ▲
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section label={tr.weaknessesHighlight} dot="#B23A3A" last>
        <ul className="space-y-1.5">
          {product.weaknesses.map((w, i) => (
            <li
              key={i}
              className="flex gap-2 text-[13px] text-bca-ink/80 leading-relaxed"
            >
              <span
                aria-hidden
                className="mt-0.5 shrink-0 text-[13px]"
                style={{ color: "#B23A3A" }}
              >
                ▼
              </span>
              <span>{w}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function CompetitorCard({ comp, tr }: { comp: Competitor; tr: any }) {
  return (
    <div
      className="rounded-[18px] p-6 relative overflow-hidden"
      style={{
        background: "linear-gradient(150deg, #F8F7F4 0%, #EDECEB 100%)",
        border: "1px solid #D9D5CF",
      }}
    >
      <span
        aria-hidden
        className="absolute top-0 left-0 h-1 w-16"
        style={{ background: "#7A7A7A" }}
      />
      <div className="mb-3">
        <span className="smallcaps text-[10px] text-bca-mute block mb-1">
          {comp.provider}
        </span>
        <h3
          className="font-serif text-bca-ink text-[19px] leading-tight"
          style={{ fontWeight: 500, letterSpacing: "-0.02em" }}
        >
          {comp.productName}
        </h3>
      </div>

      <div
        className="rounded-[10px] px-3 py-2 mb-4"
        style={{ background: "rgba(10, 27, 46, 0.04)", border: "1px solid #DCD8D1" }}
      >
        <span className="smallcaps text-[9px] text-bca-mute block mb-0.5">
          {tr.headToHeadLabel}
        </span>
        <p className="text-[12.5px] text-bca-ink/80 leading-snug">
          {comp.headToHead}
        </p>
      </div>

      {comp.strengths.length > 0 && (
        <Section label={tr.compStrengths} dot="#7A7A7A">
          <ul className="space-y-1.5">
            {comp.strengths.map((s, i) => (
              <li
                key={i}
                className="flex gap-2 text-[13px] text-bca-ink/75 leading-relaxed"
              >
                <span
                  aria-hidden
                  className="mt-0.5 shrink-0 text-[13px] text-bca-mute"
                >
                  ▲
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {comp.weaknessesVsBca.length > 0 && (
        <Section label={tr.compWeaknesses} dot="#1E7B47" last>
          <ul className="space-y-1.5">
            {comp.weaknessesVsBca.map((w, i) => (
              <li
                key={i}
                className="flex gap-2 text-[13px] text-bca-ink/85 leading-relaxed"
              >
                <span
                  aria-hidden
                  className="mt-0.5 shrink-0 text-[13px]"
                  style={{ color: "#1E7B47" }}
                >
                  ✓
                </span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function SalesScriptPanel({
  product,
  script,
  tr,
}: {
  product: ProductComparison;
  script: SalesScript;
  tr: any;
}) {
  return (
    <div className="surface-paper rounded-[18px] shadow-paper p-7 relative overflow-hidden">
      <span
        aria-hidden
        className="absolute top-0 left-0 h-1 w-full"
        style={{ background: "linear-gradient(90deg, #003D7A, #C8941E)" }}
      />

      <div className="flex items-center gap-2 mb-1 mt-1">
        <span className="smallcaps text-bca-navy text-[11px] font-semibold">
          {tr.salesScriptTitle}
        </span>
        <span className="h-px flex-1 max-w-[80px] bg-bca-rule" />
      </div>
      <p className="text-[13px] text-bca-mute mb-6">
        Produk:{" "}
        <span className="text-bca-navy font-medium">{product.shortName}</span>
      </p>

      <div className="space-y-5">
        <ScriptSection label={tr.scriptOpening} accent="#003D7A">
          <p className="text-[14px] text-bca-ink/90 leading-relaxed italic">
            &ldquo;{script.opening}&rdquo;
          </p>
        </ScriptSection>

        {script.discoveryQuestions.length > 0 && (
          <ScriptSection label={tr.scriptDiscovery} accent="#C8941E">
            <ol className="space-y-2">
              {script.discoveryQuestions.map((q, i) => (
                <li
                  key={i}
                  className="flex gap-2.5 text-[14px] text-bca-ink/85 leading-relaxed"
                >
                  <span className="text-bca-gold font-semibold shrink-0">
                    {i + 1}.
                  </span>
                  <span>&ldquo;{q}&rdquo;</span>
                </li>
              ))}
            </ol>
          </ScriptSection>
        )}

        <ScriptSection label={tr.scriptPitch} accent="#003D7A">
          <p className="text-[14px] text-bca-ink/90 leading-relaxed italic">
            &ldquo;{script.pitch}&rdquo;
          </p>
        </ScriptSection>

        {script.competitiveAdvantages.length > 0 && (
          <ScriptSection label={tr.scriptAdvantages} accent="#1E7B47">
            <ul className="space-y-2">
              {script.competitiveAdvantages.map((a, i) => (
                <li
                  key={i}
                  className="flex gap-2.5 text-[14px] text-bca-ink/85 leading-relaxed"
                >
                  <span
                    aria-hidden
                    className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                    style={{ background: "#1E7B47" }}
                  />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </ScriptSection>
        )}

        {script.objectionHandling.length > 0 && (
          <ScriptSection label={tr.scriptObjections} accent="#B23A3A">
            <div className="space-y-3">
              {script.objectionHandling.map((oh, i) => (
                <div
                  key={i}
                  className="rounded-[12px] p-3.5"
                  style={{
                    background: "rgba(10, 27, 46, 0.03)",
                    border: "1px solid #E6DFD0",
                  }}
                >
                  <div className="flex items-start gap-2 mb-2">
                    <span className="smallcaps text-[10px] text-red-700/80 shrink-0 mt-0.5">
                      {tr.objectionLabel}:
                    </span>
                    <span className="text-[13px] text-bca-ink/80 italic">
                      &ldquo;{oh.objection}&rdquo;
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="smallcaps text-[10px] text-bca-navy shrink-0 mt-0.5">
                      {tr.responseLabel}:
                    </span>
                    <span className="text-[13px] text-bca-ink/90">
                      &ldquo;{oh.response}&rdquo;
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScriptSection>
        )}

        <ScriptSection label={tr.scriptClosing} accent="#C8941E">
          <p className="text-[14px] text-bca-ink/90 leading-relaxed italic">
            &ldquo;{script.closing}&rdquo;
          </p>
        </ScriptSection>
      </div>
    </div>
  );
}

function Section({
  label,
  dot,
  last,
  children,
}: {
  label: string;
  dot: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={last ? "" : "mb-4"}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="w-1 h-1 rounded-full" style={{ background: dot }} />
        <span className="smallcaps text-[10px] font-semibold" style={{ color: dot }}>
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function ScriptSection({
  label,
  accent,
  children,
}: {
  label: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
        <span
          className="smallcaps text-[10.5px] font-semibold"
          style={{ color: accent }}
        >
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}
