import "server-only";
import { and, count, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { applications, evidence, profileSkills, skills, studentProfiles } from "@/db/schema";

/** Dashboard summary for ONE student. Always pass the session user's id, never a client value. */
export async function getStudentDashboard(userId: string) {
  const db = await getDb();
  const [profile, [ev], [apps], topSkills] = await Promise.all([
    db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.userId, userId),
      with: { college: { columns: { name: true, shortName: true } } },
    }),
    db
      .select({ n: count() })
      .from(evidence)
      .where(and(eq(evidence.userId, userId), eq(evidence.status, "verified"))),
    db.select({ n: count() }).from(applications).where(eq(applications.studentUserId, userId)),
    db
      .select({ name: skills.name, slug: skills.slug, score: profileSkills.proofScore })
      .from(profileSkills)
      .innerJoin(skills, eq(skills.id, profileSkills.skillId))
      .where(eq(profileSkills.userId, userId))
      .orderBy(desc(profileSkills.proofScore))
      .limit(5),
  ]);
  return {
    profile,
    verifiedEvidence: ev?.n ?? 0,
    applications: apps?.n ?? 0,
    topSkills,
  };
}
