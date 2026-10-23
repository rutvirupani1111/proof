import "server-only";
import { and, count, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  applications,
  attestations,
  checkAttempts,
  credentials,
  deployments,
  evidence,
  githubAccounts,
  profileSkills,
  repos,
  skills,
  studentProfiles,
} from "@/db/schema";
import { nextBestProofs } from "@/server/scoring";

/** Dashboard summary for ONE student. Always pass the session user's id, never a client value. */
export async function getStudentDashboard(userId: string) {
  const db = await getDb();
  const [profile, [ev], appRows, topSkills, recent, gh, [repoN], [depN], [checkN], [attN]] = await Promise.all([
    db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.userId, userId),
      with: { college: { columns: { name: true, shortName: true } } },
    }),
    db
      .select({ n: count() })
      .from(evidence)
      .where(and(eq(evidence.userId, userId), eq(evidence.status, "verified"))),
    db.select({ stage: applications.stage }).from(applications).where(eq(applications.studentUserId, userId)),
    db
      .select({ name: skills.name, slug: skills.slug, score: profileSkills.proofScore, evidenceCount: profileSkills.evidenceCount, breakdown: profileSkills.breakdown })
      .from(profileSkills)
      .innerJoin(skills, eq(skills.id, profileSkills.skillId))
      .where(eq(profileSkills.userId, userId))
      .orderBy(desc(profileSkills.proofScore), skills.name)
      .limit(8),
    db
      .select({
        id: evidence.id,
        kind: evidence.kind,
        title: evidence.title,
        summary: evidence.summary,
        verifiedAt: evidence.verifiedAt,
        credentialId: credentials.id,
      })
      .from(evidence)
      .leftJoin(credentials, eq(credentials.evidenceId, evidence.id))
      .where(and(eq(evidence.userId, userId), eq(evidence.status, "verified")))
      .orderBy(desc(evidence.verifiedAt))
      .limit(6),
    db.query.githubAccounts.findFirst({ where: eq(githubAccounts.userId, userId), columns: { status: true } }),
    db.select({ n: count() }).from(repos).where(and(eq(repos.userId, userId), eq(repos.status, "verified"))),
    db.select({ n: count() }).from(deployments).where(and(eq(deployments.userId, userId), eq(deployments.status, "verified"))),
    db.select({ n: count() }).from(checkAttempts).where(and(eq(checkAttempts.userId, userId), eq(checkAttempts.status, "passed"))),
    db.select({ n: count() }).from(attestations).where(and(eq(attestations.studentUserId, userId), eq(attestations.status, "endorsed"))),
  ]);

  const breakdown = profile?.scoreBreakdown ?? { authorship: 0, deployments: 0, checks: 0, endorsements: 0, recency: 0, reasons: [] };
  const next = nextBestProofs(breakdown, {
    githubVerified: gh?.status === "verified",
    repoCount: repoN?.n ?? 0,
    deploymentCount: depN?.n ?? 0,
    passedChecks: checkN?.n ?? 0,
    endorsements: attN?.n ?? 0,
  });
  const activeStages = ["applied", "screening", "skill_check", "interview", "offer"];
  return {
    profile,
    breakdown,
    verifiedEvidence: ev?.n ?? 0,
    applications: appRows.length,
    activeApplications: appRows.filter((a) => activeStages.includes(a.stage)).length,
    interviews: appRows.filter((a) => a.stage === "interview" || a.stage === "offer").length,
    topSkills,
    recent,
    next,
    counts: { repos: repoN?.n ?? 0, deployments: depN?.n ?? 0, checks: checkN?.n ?? 0, endorsements: attN?.n ?? 0 },
  };
}
