"use client";

import { authedFetch } from "./api";

// Mirrors backend app/routes_recommender.py response shapes.

export type CompetitorSource = {
  id: string;
  name: string;
  label: string;
  insurer: string;
};

export type CompareMode = "auto" | "head_to_head" | "complementary";

export type SpecRow = {
  dimension: string;
  bca: string;
  competitor: string;
  advantage: "bca" | "competitor" | "tie";
};

export type CompareSide = {
  name: string;
  provider: string;
  type: string;
  one_liner: string;
};

export type ComplementInfo = {
  narrative: string;
  how_bca_completes: string[];
  gaps_competitor_leaves: string[];
};

export type CompareResult = {
  relationship: "head_to_head" | "complementary" | null;
  relationship_reason: string;
  bca: CompareSide | null;
  competitor: CompareSide | null;
  spec_rows: SpecRow[];
  bca_advantages: string[];
  competitor_advantages: string[];
  complement: ComplementInfo | null;
  talking_points: string[];
  summary: string;
  competitor_source?: { id: string; insurer: string; name: string } | null;
  error?: string | null;
  raw?: string | null;
};

/** Competitor docs (RIPLAY/brosur) ingested in the knowledge base. */
export async function fetchCompetitors(): Promise<CompetitorSource[]> {
  const res = await authedFetch("/api/recommender/competitors");
  if (!res.ok) throw new Error(`Gagal memuat daftar kompetitor (${res.status})`);
  return res.json();
}

/** Group competitor sources by insurer for a sectioned dropdown. */
export function groupByInsurer(
  items: CompetitorSource[],
): { insurer: string; items: CompetitorSource[] }[] {
  const map = new Map<string, CompetitorSource[]>();
  for (const it of items) {
    const arr = map.get(it.insurer) ?? [];
    arr.push(it);
    map.set(it.insurer, arr);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([insurer, items]) => ({ insurer, items }));
}

/** Run a single BCA-Life-vs-competitor comparison. */
export async function compareProducts(input: {
  competitorId: string;
  bcaName: string;
  bcaStem: string;
  mode: CompareMode;
}): Promise<CompareResult> {
  const res = await authedFetch("/api/recommender/compare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      competitor_id: input.competitorId,
      bca_name: input.bcaName,
      bca_stem: input.bcaStem,
      mode: input.mode,
    }),
  });
  if (!res.ok) {
    let detail = `Gagal menjalankan perbandingan (${res.status})`;
    try {
      const j = await res.json();
      if (j?.detail) detail = typeof j.detail === "string" ? j.detail : detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json();
}
