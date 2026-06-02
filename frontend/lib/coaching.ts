import type { Scores } from "@/components/FeedbackReport";

/** Mirrors backend progress.DIMENSION_TO_PERSONA — which prospect best
 * stretches each skill, so a weak dimension maps to a concrete next session. */
export const DIMENSION_TO_PERSONA: Record<keyof Scores, string> = {
  rapport: "cautious_mom",
  discovery: "skeptical_owner",
  product_knowledge: "young_executive",
  objection_handling: "skeptical_owner",
  closing: "young_executive",
};

export function weakestDimension(scores: Scores): keyof Scores {
  const keys = Object.keys(scores) as (keyof Scores)[];
  return keys.reduce((a, b) => (scores[b] < scores[a] ? b : a), keys[0]);
}

/** Persona id to recommend practicing next, based on the weakest score. */
export function recommendedPersona(scores: Scores): string {
  return DIMENSION_TO_PERSONA[weakestDimension(scores)];
}
