/** Settings reads for ONE student. Always pass the session user's id. */
import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { studentProfiles } from "@/db/schema";

export async function getStudentSettings(userId: string) {
  const db = await getDb();
  const row = await db.query.studentProfiles.findFirst({
    where: eq(studentProfiles.userId, userId),
    columns: { handle: true, visibility: true, openToWork: true, mutedNotifications: true },
  });
  return row ?? null;
}
