"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { t, type Lang } from "@/lib/i18n";
import {
  PRODUCTS,
  type ProductComparison,
  type Competitor,
  type SalesScript,
} from "@/lib/productComparison";
import {
  fetchCompetitors,
  groupByInsurer,
  compareProducts,
  type CompetitorSource,
  type CompareMode,
  type CompareResult,
} from "@/lib/recommender";

// The customer-profile analysis flow is hidden for now (kept in git history at
// commit 4179c3d for easy restore). Flip to true to bring it back.
const SHOW_PROFILE_ANALYSIS = false;

export default function RecommendPage() {
  const [lang, setLang] = useState<Lang>("id");
  const [activeId, setActiveId] = useState<string>(PRODUCTS[0].id);
  const tr = t[lang];
  const product = PRODUCTS.find((p) => p.id === activeId) ?? PRODUCTS[0];

  return (
    <main className="min-h-screen bg-life relative overflow-hidden">
      <PageHeader
        eyebrow={tr.compareEyebrow}
        tagline="BCA Life · Advisor Cockpit"
        lang={lang}
        onLang={setLang}
        current="recommend"
      />

      {/* Hero band */}
      <section className="life-gradient relative overflow-hidden">
        <div
          aria-hidden
          className="absolute rounded-full"
          style={{
            width: 460, height: 460, right: -140, top: -180,
            background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.16), rgba(255,255,255,0))",
          }}
        />
        <div
          aria-hidden
          className="absolute rounded-full"
          style={{
            width: 300, height: 300, left: -100, bottom: -160,
            background: "radial-gradient(circle at 50% 50%, rgba(25,184,166,0.35), rgba(25,184,166,0))",
          }}
        />
        <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-8 pt-9 pb-14 animate-riseIn">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-white/90" />
            <span className="h-1 w-10 rounded-full bg-white/70" />
            <span className="ml-1 text-[11.5px] font-bold uppercase tracking-[0.13em] text-white/85">
              {tr.compareEyebrow}
            </span>
          </div>
          <h2
            className="font-sans font-extrabold text-white text-[32px] sm:text-[42px] leading-[1.08] tracking-tight"
            style={{ letterSpacing: "-0.025em" }}
          >
            {tr.compareTitle}
          </h2>
          <p className="text-[14.5px] leading-[1.6] text-white/80 mt-2.5 max-w-[620px]">
            {tr.compareSubtitle}
          </p>
          {SHOW_PROFILE_ANALYSIS && (
            <p className="text-[12px] text-white/65 mt-3">{tr.recoSubtitle}</p>
          )}
        </div>
      </section>

      <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-8 py-9 -mt-7">
        {/* Product selector */}
        <div className="mb-8 animate-riseIn">
          <span className="life-eyebrow block mb-2.5">
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
                      ? "btn-life"
                      : "bg-white text-life-heading border border-life-blue/15 hover:border-life-blue shadow-life"
                  }`}
                >
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{ background: active ? "#F9B233" : "#9db8d6" }}
                  />
                  {p.shortName}
                  {p.prototype && (
                    <span
                      className={`smallcaps text-[8.5px] px-1.5 py-0.5 rounded-full ${
                        active
                          ? "bg-white/25 text-white"
                          : "bg-life-amber/15 text-life-amberDark"
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
              style={{ background: "#0a55ab" }}
            />
            <span className="smallcaps text-life-blue text-[11px] font-semibold">
              {tr.bcaLifeCol}
            </span>
            <span className="h-px flex-1 bg-life-blue/15" />
          </div>
          <BCAProductCard product={product} tr={tr} />
        </div>

        {/* Column 2: head-to-head competitors */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: "#8a93a0" }}
            />
            <span className="smallcaps text-life-body text-[11px] font-semibold">
              {tr.competitorCol}
            </span>
            <span className="h-px flex-1 bg-life-blue/15" />
          </div>
          {product.competitors.map((comp, i) => (
            <CompetitorCard key={comp.productName + i} comp={comp} tr={tr} />
          ))}
        </div>
      </div>

      {/* Dynamic competitor-document comparator */}
      <DynamicComparator product={product} tr={tr} />

      {/* Sales script */}
      {product.script ? (
        <SalesScriptPanel product={product} script={product.script} tr={tr} />
      ) : (
        <div className="life-card p-6 text-center">
          <p className="text-[13.5px] text-life-body italic">
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
    <div className="life-card p-6 relative overflow-hidden">
      <span
        aria-hidden
        className="absolute top-0 left-0 right-0 h-1"
        style={{ background: "linear-gradient(90deg, #0a55ab, #19b8a6)" }}
      />
      <div className="mb-3">
        <span className="smallcaps text-[10px] text-life-blue block mb-1">
          BCA Life
        </span>
        <h3
          className="font-sans font-extrabold text-life-heading text-[22px] leading-tight"
          style={{ letterSpacing: "-0.02em" }}
        >
          {product.name}
        </h3>
        <span className="text-[11.5px] text-life-body mt-1.5 block">
          {tr.productTypeLabel}: {product.type}
        </span>
      </div>

      <p className="text-[13.5px] text-life-heading/80 leading-relaxed italic mb-4 pb-4 border-b border-life-blue/12">
        {product.positioning}
      </p>

      <Section label={tr.featuresLabel} dot="#0a55ab">
        <ul className="space-y-1.5">
          {product.features.map((f, i) => (
            <li
              key={i}
              className="flex gap-2 text-[13px] text-life-heading/85 leading-relaxed"
            >
              <span
                aria-hidden
                className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                style={{ background: "#0a55ab" }}
              />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section label={tr.strengthsHighlight} dot="#1f9d57">
        <ul className="space-y-1.5">
          {product.strengths.map((s, i) => (
            <li
              key={i}
              className="flex gap-2 text-[13px] text-life-heading/85 leading-relaxed"
            >
              <span
                aria-hidden
                className="mt-0.5 shrink-0 text-[13px]"
                style={{ color: "#1f9d57" }}
              >
                ▲
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section label={tr.weaknessesHighlight} dot="#c0392b" last>
        <ul className="space-y-1.5">
          {product.weaknesses.map((w, i) => (
            <li
              key={i}
              className="flex gap-2 text-[13px] text-life-heading/80 leading-relaxed"
            >
              <span
                aria-hidden
                className="mt-0.5 shrink-0 text-[13px]"
                style={{ color: "#c0392b" }}
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
      className="rounded-[16px] p-6 relative overflow-hidden"
      style={{
        background: "linear-gradient(150deg, #f3f6fa 0%, #e8edf3 100%)",
        border: "1px solid #dbe3ec",
      }}
    >
      <span
        aria-hidden
        className="absolute top-0 left-0 h-1 w-16"
        style={{ background: "#9db8d6" }}
      />
      <div className="mb-3">
        <span className="smallcaps text-[10px] text-life-body block mb-1">
          {comp.provider}
        </span>
        <h3
          className="font-sans font-bold text-life-heading text-[19px] leading-tight"
          style={{ letterSpacing: "-0.02em" }}
        >
          {comp.productName}
        </h3>
      </div>

      <div
        className="rounded-[10px] px-3 py-2 mb-4"
        style={{ background: "rgba(22, 56, 107, 0.05)", border: "1px solid #d6e0ec" }}
      >
        <span className="smallcaps text-[9px] text-life-body block mb-0.5">
          {tr.headToHeadLabel}
        </span>
        <p className="text-[12.5px] text-life-heading/80 leading-snug">
          {comp.headToHead}
        </p>
      </div>

      {comp.strengths.length > 0 && (
        <Section label={tr.compStrengths} dot="#8a93a0">
          <ul className="space-y-1.5">
            {comp.strengths.map((s, i) => (
              <li
                key={i}
                className="flex gap-2 text-[13px] text-life-heading/75 leading-relaxed"
              >
                <span
                  aria-hidden
                  className="mt-0.5 shrink-0 text-[13px] text-life-bodyLight"
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
        <Section label={tr.compWeaknesses} dot="#1f9d57" last>
          <ul className="space-y-1.5">
            {comp.weaknessesVsBca.map((w, i) => (
              <li
                key={i}
                className="flex gap-2 text-[13px] text-life-heading/85 leading-relaxed"
              >
                <span
                  aria-hidden
                  className="mt-0.5 shrink-0 text-[13px]"
                  style={{ color: "#1f9d57" }}
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
    <div className="life-card p-7 relative overflow-hidden">
      <span
        aria-hidden
        className="absolute top-0 left-0 h-1 w-full"
        style={{ background: "linear-gradient(90deg, #0a55ab, #1582b3 52%, #19b8a6)" }}
      />

      <div className="flex items-center gap-2 mb-1 mt-1">
        <span className="life-eyebrow">
          {tr.salesScriptTitle}
        </span>
        <span className="h-px flex-1 max-w-[80px] bg-life-blue/15" />
      </div>
      <p className="text-[13px] text-life-body mb-6">
        Produk:{" "}
        <span className="text-life-blue font-semibold">{product.shortName}</span>
      </p>

      <div className="space-y-5">
        <ScriptSection label={tr.scriptOpening} accent="#0a55ab">
          <p className="text-[14px] text-life-heading/90 leading-relaxed italic">
            &ldquo;{script.opening}&rdquo;
          </p>
        </ScriptSection>

        {script.discoveryQuestions.length > 0 && (
          <ScriptSection label={tr.scriptDiscovery} accent="#F9B233">
            <ol className="space-y-2">
              {script.discoveryQuestions.map((q, i) => (
                <li
                  key={i}
                  className="flex gap-2.5 text-[14px] text-life-heading/85 leading-relaxed"
                >
                  <span className="text-life-amberDark font-semibold shrink-0">
                    {i + 1}.
                  </span>
                  <span>&ldquo;{q}&rdquo;</span>
                </li>
              ))}
            </ol>
          </ScriptSection>
        )}

        <ScriptSection label={tr.scriptPitch} accent="#1582b3">
          <p className="text-[14px] text-life-heading/90 leading-relaxed italic">
            &ldquo;{script.pitch}&rdquo;
          </p>
        </ScriptSection>

        {script.competitiveAdvantages.length > 0 && (
          <ScriptSection label={tr.scriptAdvantages} accent="#1f9d57">
            <ul className="space-y-2">
              {script.competitiveAdvantages.map((a, i) => (
                <li
                  key={i}
                  className="flex gap-2.5 text-[14px] text-life-heading/85 leading-relaxed"
                >
                  <span
                    aria-hidden
                    className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                    style={{ background: "#1f9d57" }}
                  />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </ScriptSection>
        )}

        {script.objectionHandling.length > 0 && (
          <ScriptSection label={tr.scriptObjections} accent="#c0392b">
            <div className="space-y-3">
              {script.objectionHandling.map((oh, i) => (
                <div
                  key={i}
                  className="rounded-[12px] p-3.5"
                  style={{
                    background: "rgba(22, 56, 107, 0.04)",
                    border: "1px solid #dbe3ec",
                  }}
                >
                  <div className="flex items-start gap-2 mb-2">
                    <span className="smallcaps text-[10px] text-life-neg/90 shrink-0 mt-0.5">
                      {tr.objectionLabel}:
                    </span>
                    <span className="text-[13px] text-life-heading/80 italic">
                      &ldquo;{oh.objection}&rdquo;
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="smallcaps text-[10px] text-life-blue shrink-0 mt-0.5">
                      {tr.responseLabel}:
                    </span>
                    <span className="text-[13px] text-life-heading/90">
                      &ldquo;{oh.response}&rdquo;
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScriptSection>
        )}

        <ScriptSection label={tr.scriptClosing} accent="#19b8a6">
          <p className="text-[14px] text-life-heading/90 leading-relaxed italic">
            &ldquo;{script.closing}&rdquo;
          </p>
        </ScriptSection>
      </div>
    </div>
  );
}

function DynamicComparator({
  product,
  tr,
}: {
  product: ProductComparison;
  tr: any;
}) {
  const [competitors, setCompetitors] = useState<CompetitorSource[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [mode, setMode] = useState<CompareMode>("auto");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchCompetitors()
      .then((list) => alive && setCompetitors(list))
      .catch(() => alive && setLoadErr(tr.competitorLoadError));
    return () => {
      alive = false;
    };
  }, [tr.competitorLoadError]);

  // Reset result when the BCA product changes (component is keyed by product).
  async function run() {
    if (!selectedId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await compareProducts({
        competitorId: selectedId,
        bcaName: product.name,
        bcaStem: product.factsheetStem,
        mode,
      });
      if (res.error) setError(res.error);
      else setResult(res);
    } catch (e: any) {
      setError(e?.message || tr.compareError);
    } finally {
      setLoading(false);
    }
  }

  const groups = groupByInsurer(competitors);
  const modes: { key: CompareMode; label: string }[] = [
    { key: "auto", label: tr.scenarioAuto },
    { key: "head_to_head", label: tr.scenarioHeadToHead },
    { key: "complementary", label: tr.scenarioComplementary },
  ];

  return (
    <div className="life-card p-6 relative overflow-hidden">
      <span
        aria-hidden
        className="absolute top-0 left-0 right-0 h-1"
        style={{ background: "linear-gradient(90deg, #F9B233, #19b8a6)" }}
      />
      <div className="flex items-center gap-2 mb-1 mt-1">
        <span className="life-eyebrow">{tr.dynCompareTitle}</span>
        <span className="h-px flex-1 max-w-[80px] bg-life-blue/15" />
      </div>
      <p className="text-[12.5px] text-life-body leading-relaxed mb-4 max-w-[640px]">
        {tr.dynCompareDesc}
      </p>

      <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
        <div>
          <label className="smallcaps text-[10px] text-life-body block mb-1.5">
            {tr.selectCompetitorLabel}
          </label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full rounded-[12px] border border-life-blue/20 bg-white text-life-heading text-[13.5px] px-3 py-2.5 focus-gold outline-none"
          >
            <option value="">{tr.competitorPlaceholder}</option>
            {groups.map((g) => (
              <optgroup key={g.insurer} label={g.insurer}>
                {g.items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {loadErr && (
            <p className="text-[11.5px] text-life-neg mt-1.5">{loadErr}</p>
          )}
          {!loadErr && competitors.length === 0 && (
            <p className="text-[11.5px] text-life-body mt-1.5">
              {tr.noCompetitors}
            </p>
          )}
        </div>

        <div>
          <span className="smallcaps text-[10px] text-life-body block mb-1.5">
            {tr.scenarioLabel}
          </span>
          <div className="inline-flex rounded-full bg-life-blue/[0.06] border border-life-blue/12 p-0.5">
            {modes.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMode(m.key)}
                className={`px-3 py-1.5 rounded-full text-[11.5px] font-semibold transition ${
                  mode === m.key
                    ? "bg-life-blue text-white shadow-sm"
                    : "text-life-body hover:text-life-heading"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={run}
        disabled={!selectedId || loading}
        className="btn-life mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? tr.comparing : tr.compareButton}
      </button>

      {error && (
        <div className="mt-4 rounded-[12px] border border-life-neg/30 bg-life-negBg px-4 py-3 text-[13px] text-life-neg">
          {error}
        </div>
      )}

      {result && <CompareResultView result={result} tr={tr} />}
    </div>
  );
}

function CompareResultView({
  result,
  tr,
}: {
  result: CompareResult;
  tr: any;
}) {
  const isComplementary = result.relationship === "complementary";
  return (
    <div className="mt-6 pt-6 border-t border-life-blue/12 space-y-6 animate-fadeIn">
      {/* Relationship banner + summary */}
      <div>
        <span
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.1em]"
          style={
            isComplementary
              ? { background: "var(--life-amberBg)", color: "var(--life-amberDark)" }
              : { background: "var(--life-blueBg)", color: "var(--life-blue)" }
          }
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: isComplementary ? "#F9B233" : "#0a55ab" }}
          />
          {isComplementary ? tr.relComplementary : tr.relHeadToHead}
        </span>
        {result.relationship_reason && (
          <p className="text-[12.5px] text-life-body mt-2 leading-relaxed">
            {result.relationship_reason}
          </p>
        )}
      </div>

      {/* Product headers */}
      <div className="grid sm:grid-cols-2 gap-3">
        {result.bca && (
          <div className="rounded-[12px] border border-life-blue/20 bg-life-blueBg/60 p-3.5">
            <span className="smallcaps text-[9px] text-life-blue block mb-0.5">
              BCA Life
            </span>
            <div className="font-sans font-bold text-life-heading text-[15px] leading-tight">
              {result.bca.name}
            </div>
            <div className="text-[11px] text-life-body mt-0.5">{result.bca.type}</div>
            {result.bca.one_liner && (
              <p className="text-[12px] text-life-heading/80 mt-1.5 leading-snug italic">
                {result.bca.one_liner}
              </p>
            )}
          </div>
        )}
        {result.competitor && (
          <div className="rounded-[12px] border border-life-blue/12 bg-life-item p-3.5">
            <span className="smallcaps text-[9px] text-life-body block mb-0.5">
              {result.competitor.provider || tr.winnerCompTag}
            </span>
            <div className="font-sans font-bold text-life-heading text-[15px] leading-tight">
              {result.competitor.name}
            </div>
            <div className="text-[11px] text-life-body mt-0.5">
              {result.competitor.type}
            </div>
            {result.competitor.one_liner && (
              <p className="text-[12px] text-life-heading/80 mt-1.5 leading-snug italic">
                {result.competitor.one_liner}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Spec table */}
      {result.spec_rows.length > 0 && (
        <div>
          <Section label={tr.specComparison} dot="#0a55ab">
            <div className="overflow-x-auto rounded-[12px] border border-life-blue/12">
              <table className="w-full text-[12.5px] border-collapse">
                <thead>
                  <tr className="bg-life-blue/[0.05]">
                    <th className="text-left font-semibold text-life-body px-3 py-2 w-[28%]">
                      {tr.dimensionCol}
                    </th>
                    <th className="text-left font-semibold text-life-blue px-3 py-2">
                      BCA Life
                    </th>
                    <th className="text-left font-semibold text-life-body px-3 py-2">
                      {result.competitor?.provider || tr.winnerCompTag}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.spec_rows.map((r, i) => (
                    <tr
                      key={i}
                      className="border-t border-life-blue/10 align-top"
                    >
                      <td className="px-3 py-2 text-life-heading/80 font-medium">
                        {r.dimension}
                      </td>
                      <td
                        className="px-3 py-2 text-life-heading/90"
                        style={
                          r.advantage === "bca"
                            ? { background: "var(--life-posBg)" }
                            : undefined
                        }
                      >
                        <span className="inline-flex items-start gap-1.5">
                          {r.advantage === "bca" && (
                            <span style={{ color: "var(--life-pos)" }}>▲</span>
                          )}
                          <span>{r.bca}</span>
                        </span>
                      </td>
                      <td
                        className="px-3 py-2 text-life-heading/80"
                        style={
                          r.advantage === "competitor"
                            ? { background: "var(--life-item)" }
                            : undefined
                        }
                      >
                        {r.competitor}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      )}

      {/* Advantages: BCA vs competitor */}
      <div className="grid sm:grid-cols-2 gap-5">
        {result.bca_advantages.length > 0 && (
          <Section label={tr.bcaAdvantagesLabel} dot="#1f9d57">
            <ul className="space-y-1.5">
              {result.bca_advantages.map((a, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-[13px] text-life-heading/85 leading-relaxed"
                >
                  <span className="mt-0.5 shrink-0" style={{ color: "var(--life-pos)" }}>
                    ✓
                  </span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}
        {result.competitor_advantages.length > 0 && (
          <Section label={tr.competitorAdvantagesLabel} dot="#8a93a0">
            <ul className="space-y-1.5">
              {result.competitor_advantages.map((a, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-[13px] text-life-heading/75 leading-relaxed"
                >
                  <span className="mt-0.5 shrink-0 text-life-bodyLight">▲</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      {/* Complementary section */}
      {isComplementary && result.complement && (
        <div
          className="rounded-[14px] p-5"
          style={{
            background: "var(--life-amberBg)",
            border: "1px solid var(--border-1)",
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#F9B233" }} />
            <span
              className="smallcaps text-[10.5px] font-semibold"
              style={{ color: "var(--life-amberDark)" }}
            >
              {tr.complementTitle}
            </span>
          </div>
          {result.complement.narrative && (
            <p className="text-[13px] text-life-heading/85 leading-relaxed mb-3">
              {result.complement.narrative}
            </p>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            {result.complement.how_bca_completes.length > 0 && (
              <div>
                <span className="smallcaps text-[9.5px] text-life-body block mb-1.5">
                  {tr.howBcaCompletesLabel}
                </span>
                <ul className="space-y-1.5">
                  {result.complement.how_bca_completes.map((x, i) => (
                    <li
                      key={i}
                      className="flex gap-2 text-[12.5px] text-life-heading/85 leading-relaxed"
                    >
                      <span className="mt-0.5 shrink-0" style={{ color: "var(--life-pos)" }}>
                        ✓
                      </span>
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.complement.gaps_competitor_leaves.length > 0 && (
              <div>
                <span className="smallcaps text-[9.5px] text-life-body block mb-1.5">
                  {tr.gapsLeftLabel}
                </span>
                <ul className="space-y-1.5">
                  {result.complement.gaps_competitor_leaves.map((x, i) => (
                    <li
                      key={i}
                      className="flex gap-2 text-[12.5px] text-life-heading/80 leading-relaxed"
                    >
                      <span
                        className="mt-0.5 shrink-0"
                        style={{ color: "var(--life-neg)" }}
                      >
                        ▼
                      </span>
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Talking points */}
      {result.talking_points.length > 0 && (
        <Section label={tr.talkingPointsLabel} dot="#1582b3">
          <ul className="space-y-2">
            {result.talking_points.map((tp, i) => (
              <li
                key={i}
                className="flex gap-2.5 text-[13.5px] text-life-heading/90 leading-relaxed"
              >
                <span
                  aria-hidden
                  className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                  style={{ background: "#1582b3" }}
                />
                <span className="italic">&ldquo;{tp}&rdquo;</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Bottom line */}
      {result.summary && (
        <div className="rounded-[12px] bg-life-blueBg/60 border border-life-blue/15 px-4 py-3">
          <span className="smallcaps text-[9.5px] text-life-blue block mb-1">
            {tr.compareSummaryLabel}
          </span>
          <p className="text-[13.5px] text-life-heading/90 leading-relaxed">
            {result.summary}
          </p>
        </div>
      )}
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
