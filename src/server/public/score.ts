import "server-only";
import type { ScoreBreakdown } from "@/db/schema";
import { CAPS, computeProofScore } from "@/server/scoring";

export type PublicScore = {
  overall: number;
  breakdown: ScoreBreakdown | null;
  /** Line-by-line explanation from the engine ("Code authorship: +31 of 35"...). */
  explanation: string[];
  /** Per-skill scores keyed by slug, live from the engine. */
  perSkill: Record<string, { score: number; evidenceCount: number }>;
  caps: typeof CAPS;
};

/**
 * The Proof Score shown on a public dossier: always the scoring engine's live answer
 * (`computeProofScore`), read-only. Falls back to the persisted numbers if the engine throws, so a
 * scoring bug can never take a public profile down.
 */
export async function getProofScore(
  userId: string,
  persisted: { score: number; breakdown: ScoreBreakdown | null },
): Promise<PublicScore> {
  try {
    const r = await computeProofScore(userId);
    return {
      overall: r.overall,
      breakdown: r.breakdown,
      explanation: r.explanation,
      perSkill: Object.fromEntries(r.perSkill.map((s) => [s.skill, { score: s.score, evidenceCount: s.evidenceCount }])),
      caps: CAPS,
    };
  } catch (err) {
    console.error("[public] computeProofScore failed, using persisted score", err);
    return { overall: persisted.score, breakdown: persisted.breakdown, explanation: persisted.breakdown?.reasons ?? [], perSkill: {}, caps: CAPS };
  }
}
