import "server-only";
import { and, avg, count, eq, gte } from "drizzle-orm";
import { getDb } from "@/db";
import { colleges, drives, studentProfiles } from "@/db/schema";

/** Cohort summary scoped to the placement officer's college. */
export async function getCollegeDashboard(collegeId: string | null | undefined) {
  if (!collegeId) return null;
  const db = await getDb();
  const [college, [cohort], [ready], [planned]] = await Promise.all([
    db.query.colleges.findFirst({ where: eq(colleges.id, collegeId) }),
    db
      .select({ n: count(), avgScore: avg(studentProfiles.proofScore) })
      .from(studentProfiles)
      .where(eq(studentProfiles.collegeId, collegeId)),
    db
      .select({ n: count() })
      .from(studentProfiles)
      .where(and(eq(studentProfiles.collegeId, collegeId), gte(studentProfiles.proofScore, 70))),
    db.select({ n: count() }).from(drives).where(eq(drives.collegeId, collegeId)),
  ]);
  return {
    college: college ?? null,
    students: cohort?.n ?? 0,
    avgScore: Math.round(Number(cohort?.avgScore ?? 0)),
    jobReady: ready?.n ?? 0,
    drives: planned?.n ?? 0,
  };
}
