/**
 * Proof Score: loads a student's verified evidence (with the facts behind it) and runs the pure
 * engine in ./engine.ts.
 *
 *   const { overall, perSkill, explanation } = await computeProofScore(userId);   // read-only
 *   await recomputeProofScore(userId);  // also writes student_profiles + profile_skills
 *
 * No `server-only`: the seed script recomputes scores. Callers pass a user id they already
 * authorised (the session user, or a student the caller may see).
 */
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  attestations,
  checkAttempts,
  deployments,
  evidence,
  mentors,
  profileSkills,
  repoStats,
  repos,
  skillChecks,
  skills,
  studentProfiles,
} from "@/db/schema";
import { computeScore, type ExcludedRepo, type ScoreItem, type ScoreResult } from "./engine";

export { CAPS, SIGNAL_LABEL, nextBestProofs, type ScoreResult, type SkillScore, type NextProof } from "./engine";

const SEVERE = new Set(["all_commits_one_day", "bulk_import", "backdated_history", "fork_without_own_commits"]);

export async function computeProofScore(userId: string, now = new Date()): Promise<ScoreResult> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(evidence)
    .where(and(eq(evidence.userId, userId), eq(evidence.status, "verified")));

  const ids = (kind: string) => rows.filter((r) => r.kind === kind).map((r) => r.sourceId);
  const repoIds = ids("repo_authorship");
  const depIds = ids("deployment");
  const attemptIds = ids("skill_check");
  const attIds = ids("attestation");

  const [stats, deps, attempts, atts, userRepos] = await Promise.all([
    repoIds.length ? db.select().from(repoStats).where(inArray(repoStats.repoId, repoIds)) : [],
    depIds.length ? db.select().from(deployments).where(inArray(deployments.id, depIds)) : [],
    attemptIds.length
      ? db
          .select({ id: checkAttempts.id, score: checkAttempts.score, checkId: checkAttempts.skillCheckId, level: skillChecks.level })
          .from(checkAttempts)
          .innerJoin(skillChecks, eq(skillChecks.id, checkAttempts.skillCheckId))
          .where(inArray(checkAttempts.id, attemptIds))
      : [],
    attIds.length
      ? db
          .select({ id: attestations.id, mentorId: attestations.mentorId, domain: mentors.emailDomain, status: attestations.status })
          .from(attestations)
          .innerJoin(mentors, eq(mentors.id, attestations.mentorId))
          .where(inArray(attestations.id, attIds))
      : [],
    db
      .select({ name: repos.name, flags: repoStats.redFlags })
      .from(repos)
      .innerJoin(repoStats, eq(repoStats.repoId, repos.id))
      .where(eq(repos.userId, userId)),
  ]);

  const items: ScoreItem[] = [];
  for (const r of rows) {
    const base = { id: r.id, title: r.title, skills: r.skillSlugs, at: r.verifiedAt ?? r.occurredAt ?? r.createdAt };
    if (r.kind === "github_ownership") items.push({ ...base, kind: "github_ownership" });
    else if (r.kind === "repo_authorship") {
      const s = stats.find((x) => x.repoId === r.sourceId);
      if (!s || s.redFlags.some((f) => SEVERE.has(f))) continue;
      items.push({ ...base, kind: "repo_authorship", ownCommits: s.ownCommits, activeWeeks: s.activeWeeks, authorshipShare: s.authorshipShare });
    } else if (r.kind === "deployment") {
      const d = deps.find((x) => x.id === r.sourceId);
      if (!d) continue;
      const healthy = d.lastStatusCode != null ? d.lastStatusCode >= 200 && d.lastStatusCode < 400 : true;
      items.push({ ...base, kind: "deployment", healthy, homepageMatches: d.homepageMatchesRepo });
    } else if (r.kind === "skill_check") {
      const a = attempts.find((x) => x.id === r.sourceId);
      if (!a || a.score == null) continue;
      items.push({ ...base, kind: "skill_check", checkId: a.checkId, level: a.level, score: a.score });
    } else if (r.kind === "attestation") {
      const a = atts.find((x) => x.id === r.sourceId);
      if (!a || a.status !== "endorsed") continue;
      items.push({ ...base, kind: "attestation", mentorId: a.mentorId, mentorDomain: a.domain });
    }
  }

  const excluded: ExcludedRepo[] = userRepos
    .filter((r) => r.flags.some((f) => SEVERE.has(f)))
    .map((r) => ({ name: r.name, flags: r.flags }));
  return computeScore(items, now, excluded);
}

/** Computes and persists the score: student_profiles.proof_score/score_breakdown and profile_skills. */
export async function recomputeProofScore(userId: string, now = new Date()): Promise<ScoreResult> {
  const db = await getDb();
  const result = await computeProofScore(userId, now);
  await db
    .update(studentProfiles)
    .set({ proofScore: result.overall, scoreBreakdown: result.breakdown, scoreUpdatedAt: now })
    .where(eq(studentProfiles.userId, userId));

  const allSkills = await db.select({ id: skills.id, slug: skills.slug }).from(skills);
  const idBySlug = new Map(allSkills.map((s) => [s.slug, s.id]));
  const existing = await db.select().from(profileSkills).where(eq(profileSkills.userId, userId));
  const scored = new Set<string>();

  for (const s of result.perSkill) {
    const skillId = idBySlug.get(s.skill);
    if (!skillId) continue;
    scored.add(skillId);
    await db
      .insert(profileSkills)
      .values({ userId, skillId, claimed: false, proofScore: s.score, breakdown: s.breakdown, evidenceCount: s.evidenceCount })
      .onConflictDoUpdate({
        target: [profileSkills.userId, profileSkills.skillId],
        set: { proofScore: s.score, breakdown: s.breakdown, evidenceCount: s.evidenceCount },
      });
  }
  for (const row of existing) {
    if (scored.has(row.skillId)) continue;
    if (row.proofScore !== 0 || row.evidenceCount !== 0) {
      await db
        .update(profileSkills)
        .set({ proofScore: 0, evidenceCount: 0, breakdown: null })
        .where(eq(profileSkills.id, row.id));
    }
  }
  return result;
}
