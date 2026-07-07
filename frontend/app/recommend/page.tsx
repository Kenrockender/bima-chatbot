"use client";

import { useRef, useState, type DragEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { authedFetch } from "@/lib/api";
import { t, type Lang } from "@/lib/i18n";
import {
  PRODUCTS,
  type ProductComparison,
  type Competitor,
  type SalesScript,
} from "@/lib/productComparison";
import {
  compareProductsUpload,
  type CompareMode,
  type CompareResult,
} from "@/lib/recommender";

const COMPARE_UPLOAD_EXTS = [".pdf", ".pptx"];

// The customer-profile analysis flow ("lewat profil nasabah") is hidden for now
// (kept in git history for easy restore). Flip to true to bring it back.
const SHOW_PROFILE_ANALYSIS = false;

type RecoView = "compare" | "profile";

export default function RecommendPage() {
  const [lang, setLang] = useState<Lang>("id");
  const [activeId, setActiveId] = useState<string>(PRODUCTS[0].id);
  const [view, setView] = useState<RecoView>("compare");
  const tr = t[lang];
  const product = PRODUCTS.find((p) => p.id === activeId) ?? PRODUCTS[0];
  const profileView = SHOW_PROFILE_ANALYSIS && view === "profile";

  return (
    <AppShell lang={lang} onLang={setLang} current="recommend">

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
              {profileView ? tr.recoEyebrow : tr.compareEyebrow}
            </span>
          </div>
          <h2
            className="font-sans font-extrabold text-white text-[32px] sm:text-[42px] leading-[1.08] tracking-tight"
            style={{ letterSpacing: "-0.025em" }}
          >
            {profileView ? tr.recoTitle : tr.compareTitle}
          </h2>
          <p className="text-[14.5px] leading-[1.6] text-white/80 mt-2.5 max-w-[620px]">
            {profileView ? tr.recoSubtitle : tr.compareSubtitle}
          </p>
        </div>
      </section>

      <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-8 py-9 -mt-7">
        {/* Sub-page tabs */}
        {SHOW_PROFILE_ANALYSIS && (
          <div
            role="tablist"
            aria-label={tr.recoEyebrow}
            className="inline-flex gap-1 p-1 rounded-full bg-life-white border border-life-blue/12 shadow-life mb-7 animate-riseIn"
          >
            {([
              ["compare", tr.tabCompare],
              ["profile", tr.tabProfile],
            ] as const).map(([key, label]) => {
              const active = view === key;
              return (
                <button
                  key={key}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setView(key)}
                  className={`rounded-full px-5 py-2 text-[13px] font-semibold transition-all ${
                    active
                      ? "btn-life"
                      : "text-life-body hover:text-life-heading"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {profileView ? (
          /* Customer profile analysis */
          <ProfileAnalysis tr={tr} />
        ) : (
          <>
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
          </>
        )}
      </div>
    </AppShell>
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
    <div className="card-competitor rounded-[16px] p-6 relative overflow-hidden">
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

      <div className="inset-soft rounded-[10px] px-3 py-2 mb-4">
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
                <div key={i} className="inset-soft rounded-[12px] p-3.5">
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
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [mode, setMode] = useState<CompareMode>("auto");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function acceptFile(f: File | null | undefined) {
    if (!f) return;
    const ok = COMPARE_UPLOAD_EXTS.some((ext) =>
      f.name.toLowerCase().endsWith(ext),
    );
    if (!ok) {
      setError(tr.uploadInvalidType);
      return;
    }
    setError(null);
    setResult(null);
    setFile(f);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    acceptFile(e.dataTransfer.files?.[0]);
  }

  async function run() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await compareProductsUpload({
        file,
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

      <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-start">
        <div>
          <label className="smallcaps text-[10px] text-life-body block mb-1.5">
            {tr.selectCompetitorLabel}
          </label>

          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.pptx"
            className="hidden"
            onChange={(e) => acceptFile(e.target.files?.[0])}
          />

          {file ? (
            <div className="flex items-center gap-3 rounded-[12px] border border-life-blue/20 bg-white px-3.5 py-3">
              <span
                aria-hidden
                className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] bg-life-blueBg text-life-blue text-[15px]"
              >
                📄
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-life-heading">
                  {file.name}
                </div>
                <div className="text-[11px] text-life-body">
                  {(file.size / 1024).toFixed(0)} KB
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setResult(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
                className="shrink-0 text-[11.5px] font-semibold text-life-body hover:text-life-neg transition"
              >
                {tr.uploadRemove}
              </button>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`flex flex-col items-center justify-center gap-1.5 rounded-[12px] border border-dashed px-4 py-6 text-center cursor-pointer transition ${
                dragOver
                  ? "border-life-blue bg-life-blueBg/60"
                  : "border-life-blue/30 bg-life-blue/[0.03] hover:bg-life-blue/[0.06]"
              }`}
            >
              <span aria-hidden className="text-[20px] text-life-blue/70">
                ⬆️
              </span>
              <p className="text-[12.5px] text-life-body">
                {tr.uploadDropHint}{" "}
                <span className="font-semibold text-life-blue underline">
                  {tr.uploadBrowse}
                </span>
              </p>
              <p className="text-[10.5px] text-life-body/70">{tr.uploadFormats}</p>
            </div>
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
        disabled={!file || loading}
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

// ─────────────────────────── Profile Analysis ───────────────────────────

type Profile = {
  name: string; age: string; gender: string; marital: string;
  dependents: string; income_per_month: string; health_notes: string;
  budget_premium_per_month: string; goal: string; horizon_years: string; notes: string;
};

const EMPTY_PROFILE: Profile = {
  name: "", age: "", gender: "laki-laki", marital: "", dependents: "",
  income_per_month: "", health_notes: "", budget_premium_per_month: "",
  goal: "", horizon_years: "", notes: "",
};

type Recommendation = {
  customer_summary: string;
  bca_recommendations: {
    product_name: string; fit_score: number; suggested_up: string;
    suggested_premium: string; suggested_tenor: string;
    rationale: string[]; concerns: string[];
  }[];
  competitor_comparisons: {
    provider: string; product_name: string; similar_to: string;
    fit_score: number; strengths: string[]; weaknesses_vs_bca: string[];
  }[];
  error?: string;
};

function ProfileAnalysis({ tr }: { tr: any }) {
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Recommendation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setProfile((p) => ({ ...p, [k]: e.target.value }));

  const ready = profile.age && parseInt(profile.age) > 0 && parseInt(profile.age) <= 120;

  async function submit() {
    if (!ready || loading) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const body: any = { age: parseInt(profile.age), gender: profile.gender };
      if (profile.name) body.name = profile.name;
      if (profile.marital) body.marital = profile.marital;
      if (profile.dependents) body.dependents = parseInt(profile.dependents);
      if (profile.income_per_month) body.income_per_month = parseFloat(profile.income_per_month);
      if (profile.health_notes) body.health_notes = profile.health_notes;
      if (profile.budget_premium_per_month) body.budget_premium_per_month = parseFloat(profile.budget_premium_per_month);
      if (profile.goal) body.goal = profile.goal;
      if (profile.horizon_years) body.horizon_years = parseInt(profile.horizon_years);
      if (profile.notes) body.notes = profile.notes;
      const res = await authedFetch("/api/recommender/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      if (data.error) setError(data.error); else setResult(data);
    } catch { setError(tr.fetchError); }
    finally { setLoading(false); }
  }

  const inputCls = "w-full rounded-[10px] border border-life-blue/15 bg-life-white px-3 py-2 text-[13.5px] text-life-heading placeholder:text-life-bodyLight transition focus:outline-none focus:border-life-blue focus:ring-2 focus:ring-life-blue/15";
  const labelCls = "text-[11px] uppercase tracking-[0.12em] font-semibold text-life-body block mb-1";

  return (
    <div className="life-card p-6 relative overflow-hidden animate-fadeIn">
      <span aria-hidden className="absolute top-0 left-0 right-0 h-1" style={{ background: "linear-gradient(90deg, #F9B233, #0a55ab)" }} />
      <div className="flex items-center gap-2 mb-1 mt-1">
        <span className="life-eyebrow">{tr.recoFormTitle}</span>
        <span className="h-px flex-1 max-w-[80px] bg-life-blue/15" />
      </div>
      <p className="text-[12.5px] text-life-body leading-relaxed mb-5 max-w-[640px]">{tr.recoSubtitle}</p>

      {!result ? (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            <label><span className={labelCls}>{tr.fieldName}</span><input type="text" value={profile.name} onChange={set("name")} placeholder="Budi" className={inputCls} /></label>
            <label><span className={labelCls}>{tr.fieldAge} *</span><input type="number" min={0} max={120} value={profile.age} onChange={set("age")} placeholder="35" className={inputCls} /></label>
            <label><span className={labelCls}>{tr.fieldGender} *</span><select value={profile.gender} onChange={set("gender")} className={inputCls}><option value="laki-laki">{tr.fieldGenderM}</option><option value="perempuan">{tr.fieldGenderF}</option></select></label>
            <label><span className={labelCls}>{tr.fieldMarital}</span><select value={profile.marital} onChange={set("marital")} className={inputCls}><option value="">—</option><option value="lajang">{tr.maritalSingle}</option><option value="menikah">{tr.maritalMarried}</option><option value="cerai">{tr.maritalDivorced}</option></select></label>
            <label><span className={labelCls}>{tr.fieldDependents}</span><input type="number" min={0} max={20} value={profile.dependents} onChange={set("dependents")} placeholder="2" className={inputCls} /></label>
            <label><span className={labelCls}>{tr.fieldIncome}</span><input type="number" min={0} step={0.5} value={profile.income_per_month} onChange={set("income_per_month")} placeholder="15" className={inputCls} /></label>
            <label><span className={labelCls}>{tr.fieldBudget}</span><input type="number" min={0} step={0.1} value={profile.budget_premium_per_month} onChange={set("budget_premium_per_month")} placeholder="1.5" className={inputCls} /></label>
            <label><span className={labelCls}>{tr.fieldGoal}</span><input type="text" value={profile.goal} onChange={set("goal")} placeholder={tr.goalProtection} className={inputCls} /></label>
            <label><span className={labelCls}>{tr.fieldHorizon}</span><input type="number" min={1} max={99} value={profile.horizon_years} onChange={set("horizon_years")} placeholder="20" className={inputCls} /></label>
          </div>
          <label className="block mb-4"><span className={labelCls}>{tr.fieldNotes}</span><textarea rows={2} value={profile.notes} onChange={set("notes")} placeholder={tr.fieldNotesPh} className={inputCls + " resize-none"} /></label>
          <div className="flex items-center gap-3">
            <button onClick={submit} disabled={!ready || loading} className="btn-life disabled:opacity-50 disabled:cursor-not-allowed">{loading ? tr.submitting : tr.submitReco}</button>
            <button onClick={() => setProfile(EMPTY_PROFILE)} type="button" className="text-[12px] text-life-body hover:text-life-blue transition">{tr.resetForm}</button>
          </div>
          {error && <div className="mt-4 rounded-xl border border-life-neg/30 bg-life-negBg px-4 py-3 text-[13px] text-life-neg">{error}</div>}
        </>
      ) : (
        <ProfileResult result={result} tr={tr} onBack={() => setResult(null)} />
      )}
    </div>
  );
}

function ProfileResult({ result, tr, onBack }: { result: Recommendation; tr: any; onBack: () => void }) {
  return (
    <div className="space-y-5 animate-fadeIn">
      {result.customer_summary && (
        <div className="rounded-xl bg-life-blueBg/60 border border-life-blue/15 px-4 py-3">
          <span className="smallcaps text-[9.5px] text-life-blue block mb-1">{tr.recoEyebrow}</span>
          <p className="text-[13.5px] text-life-heading/90 leading-relaxed">{result.customer_summary}</p>
        </div>
      )}
      {result.bca_recommendations.map((rec, i) => (
        <div key={i} className="life-card p-5 relative overflow-hidden">
          <span aria-hidden className="absolute top-0 left-0 right-0 h-1" style={{ background: "linear-gradient(90deg, #0a55ab, #19b8a6)" }} />
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="font-sans font-bold text-life-heading text-[18px]">{rec.product_name}</h3>
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold bg-life-posBg text-life-pos">Fit: {rec.fit_score}/10</span>
          </div>
          <div className="grid sm:grid-cols-3 gap-3 mb-4">
            {[["UP", rec.suggested_up], [tr.fieldBudget, rec.suggested_premium], ["Tenor", rec.suggested_tenor]].map(([lbl, val], j) => (
              <div key={j} className="rounded-lg bg-life-item p-3">
                <span className="smallcaps text-[9px] text-life-body block mb-0.5">{lbl}</span>
                <span className="text-[14px] font-semibold text-life-heading">{val}</span>
              </div>
            ))}
          </div>
          {rec.rationale.length > 0 && (
            <Section label={tr.rationaleLabel} dot="#1f9d57"><ul className="space-y-1.5">{rec.rationale.map((r, j) => (
              <li key={j} className="flex gap-2 text-[13px] text-life-heading/85 leading-relaxed"><span className="mt-0.5 shrink-0" style={{ color: "#1f9d57" }}>✓</span><span>{r}</span></li>
            ))}</ul></Section>
          )}
          {rec.concerns.length > 0 && (
            <Section label={tr.concernsLabel} dot="#c0392b"><ul className="space-y-1.5">{rec.concerns.map((c, j) => (
              <li key={j} className="flex gap-2 text-[13px] text-life-heading/80 leading-relaxed"><span className="mt-0.5 shrink-0" style={{ color: "#c0392b" }}>▼</span><span>{c}</span></li>
            ))}</ul></Section>
          )}
        </div>
      ))}
      <button onClick={onBack} className="inline-flex items-center gap-2 text-[13px] font-semibold text-life-blue hover:text-life-heading transition">← {tr.backToForm}</button>
    </div>
  );
}
