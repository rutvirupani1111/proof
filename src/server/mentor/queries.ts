import "server-only";
import { and, count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { attestations, mentors } from "@/db/schema";

/** Endorsement summary for the signed-in mentor. */
export async function getMentorDashboard(userId: string) {
  const db = await getDb();
  const mentor = await db.query.mentors.findFirst({ where: eq(mentors.userId, userId) });
  if (!mentor) return { mentor: null, requested: 0, endorsed: 0 };
  const [[requested], [endorsed]] = await Promise.all([
    db
      .select({ n: count() })
      .from(attestations)
      .where(and(eq(attestations.mentorId, mentor.id), eq(attestations.status, "requested"))),
    db
      .select({ n: count() })
      .from(attestations)
      .where(and(eq(attestations.mentorId, mentor.id), eq(attestations.status, "endorsed"))),
  ]);
  return { mentor, requested: requested?.n ?? 0, endorsed: endorsed?.n ?? 0 };
}
