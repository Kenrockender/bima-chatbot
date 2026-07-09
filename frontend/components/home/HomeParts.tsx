"use client";

import { useState } from "react";
import type { Persona } from "@/components/PersonaCard";
import { t } from "@/lib/i18n";

// Persona id reserved for the FA-defined custom persona. Shared between the
// home page and these presentational parts so there's a single source of truth.
export const CUSTOM_ID = "custom";

export type CustomConfig = {
  name?: string;
  background?: string;
  needs?: string;
  challenge?: string;
};

export type DrillBrief = {
  id: string;
  title: string;
  dimension: string;
  summary: string;
  objective?: string | null;
};

type Tr = (typeof t)["en"] | (typeof t)["id"];

export function CustomCta({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`group w-full mt-1 flex items-center gap-2.5 px-2.5 py-2 rounded-xl border border-dashed transition ${
        selected
          ? "bg-life-blueBg border-life-blue/50 text-life-heading"
          : "border-life-blue/25 text-life-body hover:border-life-blue/50 hover:text-life-heading"
      }`}
    >
      <span
        aria-hidden
        className="shrink-0 grid place-items-center rounded-full border border-current"
        style={{ width: 32, height: 32, fontSize: 18, lineHeight: 1 }}
      >
        +
      </span>
      <span className="flex-1 min-w-0 text-[13px] font-semibold truncate">
        {label}
      </span>
    </button>
  );
}

export function DrillBriefing({
  drill,
  tr,
}: {
  drill: DrillBrief;
  tr: Tr;
}) {
  const dimLabel = (tr as Record<string, string>)[drill.dimension] ?? drill.dimension;
  return (
    <div className="mb-5 rounded-2xl border border-life-teal/25 bg-life-blueBg/50 p-5 animate-fadeIn">
      <div className="flex items-center gap-2 mb-2.5">
        <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-life-teal" />
        <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-life-teal">
          {tr.drillFocusLabel} · {dimLabel}
        </span>
      </div>
      <h3 className="font-sans font-extrabold text-life-heading text-[18px] leading-snug mb-3">
        {drill.title}
      </h3>
      <div className="space-y-2 text-[13px] leading-relaxed">
        <p>
          <span className="font-semibold text-life-heading">{tr.drillScenarioLabel}: </span>
          <span className="text-life-body">{drill.summary}</span>
        </p>
        {drill.objective && (
          <p>
            <span className="font-semibold text-life-heading">{tr.drillObjectiveLabel}: </span>
            <span className="text-life-body">{drill.objective}</span>
          </p>
        )}
      </div>
    </div>
  );
}

export function Welcome({
  tr,
  selected,
  starting,
  error,
  onStart,
  onStartCustom,
}: {
  tr: Tr;
  selected: Persona | null;
  starting: boolean;
  error?: boolean;
  onStart: (p: Persona) => void;
  onStartCustom: (cfg: CustomConfig) => void;
}) {
  const isCustom = selected?.id === CUSTOM_ID;
  return (
    <div className="max-w-[640px] mx-auto py-6 animate-fadeIn">
      <div className="inline-flex items-center gap-2 mb-4">
        <span aria-hidden className="w-6 h-px bg-life-amber" />
        <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-life-amberDark">
          {tr.brandLine}
        </span>
      </div>
      <h2
        className="font-sans font-extrabold text-life-heading text-[34px] sm:text-[40px] leading-[1.1] tracking-tight mb-4"
        style={{ letterSpacing: "-0.025em" }}
      >
        {tr.landingHeadline}
      </h2>
      <p className="text-[15px] leading-[1.65] text-life-body mb-6 max-w-[560px]">
        {tr.landingSubtitle}
      </p>

      <div className="bubble-sera max-w-[460px]">
        <p className="text-[13.5px] leading-[1.6]">
          {selected
            ? isCustom
              ? tr.customIntro
              : `${tr.pickPersona}: ${selected.name} · ${selected.title}. ${selected.summary}`
            : tr.pickPersonaHint}
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-life-neg/30 bg-life-negBg px-4 py-3 text-[13px] text-life-neg max-w-[460px]">
          {tr.fetchError}
        </div>
      )}

      {isCustom ? (
        <CustomPersonaForm tr={tr} starting={starting} onStart={onStartCustom} />
      ) : (
        selected && (
          <div className="mt-5">
            <button
              onClick={() => onStart(selected)}
              disabled={starting}
              className="inline-flex items-center gap-2 bg-life-blue hover:brightness-110 text-white text-[13.5px] font-semibold rounded-full px-5 py-3 shadow-soft transition disabled:opacity-60"
            >
              <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-life-amber" />
              {starting ? "…" : tr.startSession}
            </button>
          </div>
        )
      )}
    </div>
  );
}

function CustomPersonaForm({
  tr,
  starting,
  onStart,
}: {
  tr: Tr;
  starting: boolean;
  onStart: (cfg: CustomConfig) => void;
}) {
  const [name, setName] = useState("");
  const [background, setBackground] = useState("");
  const [needs, setNeeds] = useState("");
  const [challenge, setChallenge] = useState("Sedang");

  const ready = background.trim().length > 0 || needs.trim().length > 0;

  function submit() {
    if (!ready || starting) return;
    onStart({
      name: name.trim() || undefined,
      background: background.trim() || undefined,
      needs: needs.trim() || undefined,
      challenge,
    });
  }

  return (
    <div className="mt-5 rounded-2xl border border-life-blue/12 bg-white p-5 max-w-[520px] shadow-life">
      <div className="flex items-center gap-2 mb-4">
        <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-life-amber" />
        <span className="text-[11px] uppercase tracking-[0.16em] font-bold text-bca-ink/70">
          {tr.customFormTitle}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 mb-3">
        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-bca-ink/55 block mb-1">
            {tr.customNameLabel}
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder={tr.customNamePh}
            className="custom-field"
          />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-bca-ink/55 block mb-1">
            {tr.customChallengeLabel}
          </span>
          <select
            value={challenge}
            onChange={(e) => setChallenge(e.target.value)}
            className="custom-field"
          >
            <option value="Mudah">{tr.diffEasy}</option>
            <option value="Sedang">{tr.diffMedium}</option>
            <option value="Sulit">{tr.diffHard}</option>
          </select>
        </label>
      </div>

      <label className="block mb-3">
        <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-bca-ink/55 block mb-1">
          {tr.customBackgroundLabel}
        </span>
        <textarea
          value={background}
          onChange={(e) => setBackground(e.target.value)}
          rows={3}
          maxLength={600}
          placeholder={tr.customBackgroundPh}
          className="custom-field resize-none"
        />
      </label>

      <label className="block mb-1">
        <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-bca-ink/55 block mb-1">
          {tr.customNeedsLabel}
        </span>
        <textarea
          value={needs}
          onChange={(e) => setNeeds(e.target.value)}
          rows={3}
          maxLength={600}
          placeholder={tr.customNeedsPh}
          className="custom-field resize-none"
        />
      </label>

      <p className="text-[11.5px] text-bca-ink/50 mt-2 mb-4">{tr.customRequiredHint}</p>

      <button
        onClick={submit}
        disabled={!ready || starting}
        className="inline-flex items-center gap-2 bg-life-blue hover:brightness-110 text-white text-[13.5px] font-semibold rounded-full px-5 py-3 shadow-soft transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-life-amber" />
        {starting ? "…" : tr.customStart}
      </button>

      <style jsx>{`
        :global(.custom-field) {
          width: 100%;
          background: var(--life-surface);
          border: 1px solid var(--border-1);
          border-radius: 10px;
          padding: 0.5rem 0.7rem;
          font-size: 13.5px;
          color: var(--life-heading);
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        :global(.custom-field::placeholder) {
          color: var(--life-bodyLight);
        }
        :global(.custom-field:focus) {
          outline: none;
          border-color: var(--life-blue);
          box-shadow: 0 0 0 4px rgba(10, 85, 171, 0.16);
        }
      `}</style>
    </div>
  );
}

export function EndingState({ tr }: { tr: Tr }) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center animate-fadeIn">
        <div className="flex justify-center mb-3" aria-hidden>
          <span
            className="inline-block w-2.5 h-2.5 rounded-full animate-blink mx-1"
            style={{ background: "#0a55ab" }}
          />
          <span
            className="inline-block w-2.5 h-2.5 rounded-full animate-blink mx-1"
            style={{ background: "#1582b3", animationDelay: "200ms" }}
          />
          <span
            className="inline-block w-2.5 h-2.5 rounded-full animate-blink mx-1"
            style={{ background: "#19b8a6", animationDelay: "400ms" }}
          />
        </div>
        <p className="font-sans font-extrabold text-life-heading text-[22px]">
          {tr.reportEyebrow}…
        </p>
      </div>
    </div>
  );
}

export function TypingIndicator({ label }: { label: string }) {
  return (
    <div className="flex items-start gap-3 mb-4 animate-fadeIn">
      <div
        aria-hidden
        className="shrink-0 rounded-full flex items-center justify-center"
        style={{
          width: 38,
          height: 38,
          background:
            "radial-gradient(120% 120% at 30% 25%, #2E68C6 0%, #0F3C86 55%, #061B45 100%)",
        }}
      >
        <span className="text-[10px] font-bold text-life-amber">B</span>
      </div>
      <div className="bubble-sera inline-flex items-center gap-3" role="status" aria-label={label}>
        <span className="flex items-center gap-1.5" aria-hidden>
          <span className="w-2 h-2 rounded-full bg-life-blue animate-blink" />
          <span
            className="w-2 h-2 rounded-full bg-life-blue animate-blink"
            style={{ animationDelay: "200ms" }}
          />
          <span
            className="w-2 h-2 rounded-full bg-life-blue animate-blink"
            style={{ animationDelay: "400ms" }}
          />
        </span>
        <span className="text-[12.5px] italic text-bca-ink/65">{label}…</span>
      </div>
    </div>
  );
}

export function MicIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}

export function SpeakerIcon({ active }: { active?: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polygon points="3 10 7 10 12 5 12 19 7 14 3 14 3 10" />
      {active && (
        <>
          <path d="M16 8a5 5 0 0 1 0 8" />
          <path d="M19 5a9 9 0 0 1 0 14" />
        </>
      )}
    </svg>
  );
}

export function PlayIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polygon points="3 10 7 10 12 5 12 19 7 14 3 14 3 10" />
      <path d="M16 8a5 5 0 0 1 0 8" />
    </svg>
  );
}

export function MuteIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polygon points="3 10 7 10 12 5 12 19 7 14 3 14 3 10" />
      <line x1="18" y1="9" x2="22" y2="13" />
      <line x1="22" y1="9" x2="18" y2="13" />
    </svg>
  );
}

export function SendIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ transform: "translateX(1px)" }}
    >
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
    </svg>
  );
}

export function VoicePicker({
  voices,
  lang,
  selectedName,
  autoLabel,
  pickerLabel,
  testLabel,
  sample: _sample,
  onSelect,
  onTest,
}: {
  voices: SpeechSynthesisVoice[];
  lang: string;
  selectedName: string | null;
  autoLabel: string;
  pickerLabel: string;
  testLabel: string;
  sample: string;
  onSelect: (name: string | null) => void;
  onTest: () => void;
}) {
  const family = lang.split("-")[0].toLowerCase();
  const inLang = voices.filter(
    (v) => v.lang === lang || v.lang.toLowerCase().startsWith(family),
  );
  const others = voices.filter((v) => !inLang.includes(v));

  const friendly = (v: SpeechSynthesisVoice) => {
    let n = v.name;
    n = n.replace(/Microsoft\s+/i, "").replace(/\s*Online\s*\(Natural\)/i, " · Natural");
    n = n.replace(/\s*\(Natural\)/i, " · Natural");
    return `${n} — ${v.lang}`;
  };

  return (
    <div className="inline-flex items-center gap-1.5">
      <label className="text-[10.5px] uppercase tracking-[0.14em] font-bold text-bca-ink/55">
        {pickerLabel}
      </label>
      <select
        value={selectedName ?? ""}
        onChange={(e) => onSelect(e.target.value || null)}
        aria-label={pickerLabel}
        className="text-[11px] font-medium px-2 py-1 rounded-full border border-life-blue/15 bg-white text-life-heading hover:border-life-blue/40 focus:outline-none focus:ring-1 focus:ring-life-blue max-w-[180px] truncate"
      >
        <option value="">{autoLabel}</option>
        {inLang.length > 0 && (
          <optgroup label={lang}>
            {inLang.map((v) => (
              <option key={v.name} value={v.name}>
                {friendly(v)}
              </option>
            ))}
          </optgroup>
        )}
        {others.length > 0 && (
          <optgroup label="Other">
            {others.map((v) => (
              <option key={v.name} value={v.name}>
                {friendly(v)}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      <button
        type="button"
        onClick={onTest}
        title={testLabel}
        aria-label={testLabel}
        className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-life-blue/15 bg-life-white/60 text-life-body hover:border-life-blue/50 hover:text-life-blue transition"
      >
        <PlayIcon />
      </button>
    </div>
  );
}
