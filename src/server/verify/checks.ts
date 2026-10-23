/**
 * Skill-check sessions: start a timed attempt, run the visible samples, submit for grading
 * against hidden tests in the QuickJS sandbox. Hidden tests never leave the server.
 */
import "server-only";
import { and, count, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { checkAttempts, skillChecks, skills } from "@/db/schema";
import { PASS_MARK } from "@/server/scoring/engine";
import { recordVerifiedEvidence } from "./evidence";
import { VerifyError } from "./github";
import { gradeSubmission } from "./sandbox";

/** Grace for network latency on submit after the clock runs out. */
const GRACE_SEC = 30;

/** Public columns only: never select hiddenTests for anything the client sees. */
export const publicCheckColumns = {
  id: true,
  slug: true,
  title: true,
  level: true,
  language: true,
  prompt: true,
  starterCode: true,
  entryFunction: true,
  sampleTests: true,
  timeLimitSec: true,
  skillId: true,
} as const;

export async function startAttempt(userId: string, slug: string) {
  const db = await getDb();
  const check = await db.query.skillChecks.findFirst({ where: and(eq(skillChecks.slug, slug), eq(skillChecks.isPublished, true)), columns: { id: true, timeLimitSec: true } });
  if (!check) throw new VerifyError("Skill check not found.");
  const open = await db.query.checkAttempts.findFirst({
    where: and(eq(checkAttempts.userId, userId), eq(checkAttempts.skillCheckId, check.id), eq(checkAttempts.status, "in_progress")),
    orderBy: desc(checkAttempts.createdAt),
  });
  if (open?.startedAt && Date.now() - open.startedAt.getTime() < (check.timeLimitSec + GRACE_SEC) * 1000) return open;
  if (open) await db.update(checkAttempts).set({ status: "expired", submittedAt: new Date() }).where(eq(checkAttempts.id, open.id));
  // A recruiter invite for this check is picked up rather than duplicated.
  const invited = await db.query.checkAttempts.findFirst({
    where: and(eq(checkAttempts.userId, userId), eq(checkAttempts.skillCheckId, check.id), eq(checkAttempts.status, "invited")),
  });
  if (invited) {
    const [row] = await db.update(checkAttempts).set({ status: "in_progress", startedAt: new Date() }).where(eq(checkAttempts.id, invited.id)).returning();
    return row!;
  }
  const [row] = await db.insert(checkAttempts).values({ userId, skillCheckId: check.id, status: "in_progress", startedAt: new Date() }).returning();
  return row!;
}

export async function runSamples(userId: string, slug: string, code: string) {
  const db = await getDb();
  const check = await db.query.skillChecks.findFirst({ where: eq(skillChecks.slug, slug), columns: { entryFunction: true, sampleTests: true } });
  if (!check) throw new VerifyError("Skill check not found.");
  void userId;
  return gradeSubmission(code, check.entryFunction, { visible: check.sampleTests, hidden: [] });
}

export async function submitAttempt(
  userId: string,
  input: { attemptId: string; code: string; pasteEvents: number; tabBlurs: number },
) {
  const db = await getDb();
  const attempt = await db.query.checkAttempts.findFirst({
    where: and(eq(checkAttempts.id, input.attemptId), eq(checkAttempts.userId, userId)),
  });
  if (!attempt) throw new VerifyError("Attempt not found.");
  if (attempt.status !== "in_progress") throw new VerifyError("This attempt was already submitted.");
  const check = await db.query.skillChecks.findFirst({ where: eq(skillChecks.id, attempt.skillCheckId) });
  if (!check) throw new VerifyError("Skill check not found.");
  const skill = check.skillId ? await db.query.skills.findFirst({ where: eq(skills.id, check.skillId), columns: { slug: true, name: true } }) : null;

  const now = new Date();
  const started = attempt.startedAt ?? attempt.createdAt;
  const timeTakenSec = Math.round((now.getTime() - started.getTime()) / 1000);
  const overtime = timeTakenSec > check.timeLimitSec + GRACE_SEC;

  const result = await gradeSubmission(input.code, check.entryFunction, { visible: check.sampleTests, hidden: check.hiddenTests });
  const passed = !overtime && result.score >= PASS_MARK;
  await db
    .update(checkAttempts)
    .set({
      code: input.code,
      score: result.score,
      passedTests: result.passed,
      totalTests: result.total,
      submittedAt: now,
      timeTakenSec,
      pasteEvents: Math.max(attempt.pasteEvents, input.pasteEvents),
      tabBlurs: Math.max(attempt.tabBlurs, input.tabBlurs),
      status: overtime ? "expired" : passed ? "passed" : "failed",
    })
    .where(eq(checkAttempts.id, attempt.id));

  const [attemptsSoFar] = await db
    .select({ n: count() })
    .from(checkAttempts)
    .where(and(eq(checkAttempts.userId, userId), eq(checkAttempts.skillCheckId, check.id)));

  const base = { result, overtime, timeTakenSec, attempts: attemptsSoFar?.n ?? 1 };
  if (!passed) return { ...base, passed: false as const };

  const recorded = await recordVerifiedEvidence({
    userId,
    kind: "skill_check",
    sourceId: attempt.id,
    title: `Passed “${check.title}” (${check.level})`,
    summary: `${result.passed}/${result.total} tests in ${Math.max(1, Math.round(timeTakenSec / 60))} min`,
    skillSlugs: skill ? [skill.slug] : ["javascript"],
    data: { check: check.slug, level: check.level, score: result.score, timeTakenSec, attempts: base.attempts, pasteEvents: input.pasteEvents, tabBlurs: input.tabBlurs },
    weight: 1.2,
    notify: { title: `Passed “${check.title}”`, body: `${result.score}% on hidden tests`, href: "/student/checks" },
  });
  return { ...base, passed: true as const, ...recorded };
}
