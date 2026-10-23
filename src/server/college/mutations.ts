/**
 * Placement-cell writes. Every function takes the session-derived CollegeScope and touches only
 * drives and students of that college; ids from elsewhere behave as "not found".
 */
import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { driveStudents, drives, notifications, studentProfiles } from "@/db/schema";
import type { DriveCreateInput, DriveStudentStatusId, NudgeGap } from "@/lib/validation/college";
import { ScopeError } from "@/server/recruiter/scope";
import { eligibleStudentIds, getCohortStudents } from "./queries";
import type { CollegeScope } from "./scope";

async function assertDrive(scope: CollegeScope, driveId: string) {
  const db = await getDb();
  const drive = await db.query.drives.findFirst({
    where: and(eq(drives.id, driveId), eq(drives.collegeId, scope.collegeId)),
  });
  if (!drive) throw new ScopeError("Drive not found.");
  return drive;
}

/** Add every currently eligible student to the roster as "eligible"; notify the new ones. */
export async function syncEligible(scope: CollegeScope, driveId: string) {
  const drive = await assertDrive(scope, driveId);
  const db = await getDb();
  const ids = await eligibleStudentIds(scope, drive.eligibility ?? {});
  if (!ids.length) return { added: 0 };
  const added = await db
    .insert(driveStudents)
    .values(ids.map((studentUserId) => ({ driveId: drive.id, studentUserId, status: "eligible" as const })))
    .onConflictDoNothing()
    .returning({ studentUserId: driveStudents.studentUserId });
  if (added.length) {
    const when = drive.scheduledAt ? ` on ${drive.scheduledAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : "";
    await db.insert(notifications).values(
      added.map((a) => ({
        userId: a.studentUserId,
        type: "drive.eligible",
        title: `You're eligible for ${drive.companyName}`,
        body: `${drive.title}${when}. Your verified evidence meets the bar.`,
        href: "/student",
      })),
    );
  }
  return { added: added.length };
}

export async function createDrive(scope: CollegeScope, input: DriveCreateInput) {
  const db = await getDb();
  const [row] = await db
    .insert(drives)
    .values({
      collegeId: scope.collegeId,
      companyName: input.companyName,
      title: input.title,
      scheduledAt: input.scheduledAt,
      location: input.location || null,
      eligibility: input.eligibility,
      status: "planned",
      createdByUserId: scope.userId,
    })
    .returning({ id: drives.id });
  const { added } = await syncEligible(scope, row!.id);
  return { id: row!.id, eligible: added };
}

export async function setDriveStatus(scope: CollegeScope, driveId: string, status: "planned" | "open" | "completed" | "cancelled") {
  await assertDrive(scope, driveId);
  const db = await getDb();
  await db.update(drives).set({ status }).where(and(eq(drives.id, driveId), eq(drives.collegeId, scope.collegeId)));
}

export async function updateDriveStudent(
  scope: CollegeScope,
  input: { driveId: string; studentUserId: string; status: DriveStudentStatusId; result?: string },
) {
  const drive = await assertDrive(scope, input.driveId);
  const db = await getDb();
  const student = await db.query.studentProfiles.findFirst({
    where: and(eq(studentProfiles.userId, input.studentUserId), eq(studentProfiles.collegeId, scope.collegeId)),
    columns: { id: true },
  });
  if (!student) throw new ScopeError("Student not found in your college.");
  const [row] = await db
    .update(driveStudents)
    .set({ status: input.status, result: input.result ?? null })
    .where(and(eq(driveStudents.driveId, drive.id), eq(driveStudents.studentUserId, input.studentUserId)))
    .returning({ status: driveStudents.status });
  if (!row) throw new ScopeError("Student is not on this drive.");
  if (input.status === "selected") {
    await db.insert(notifications).values({
      userId: input.studentUserId,
      type: "drive.selected",
      title: `Selected by ${drive.companyName}`,
      body: input.result || `${drive.title}: congratulations from your placement cell.`,
      href: "/student",
    });
  }
  return row;
}

const GAP_COPY: Record<NudgeGap, string> = {
  github: "prove your GitHub account",
  repo: "import a repo you wrote",
  deployment: "verify a live deployment",
  check: "pass a skill check",
  endorsement: "request a mentor endorsement",
};

/**
 * Nudge students with incomplete proofs. Ids outside this college are silently dropped, so the
 * returned count is the number of notifications actually created.
 */
export async function nudgeStudents(scope: CollegeScope, studentUserIds: string[], message?: string) {
  const cohort = await getCohortStudents(scope);
  const byId = new Map(cohort.map((s) => [s.userId, s]));
  const targets = [...new Set(studentUserIds)].map((id) => byId.get(id)).filter((s): s is NonNullable<typeof s> => !!s);
  if (!targets.length) return { sent: 0 };
  const db = await getDb();
  await db.insert(notifications).values(
    targets.map((s) => {
      const next = s.gaps.slice(0, 2).map((g) => GAP_COPY[g]);
      const body = message?.trim() || (next.length ? `Next step: ${next.join(", then ")}.` : "Keep your evidence fresh before drives open.");
      return {
        userId: s.userId,
        type: "college.nudge",
        title: "Your placement cell: finish your proofs",
        body,
        href: "/student/proofs",
      };
    }),
  );
  return { sent: targets.length };
}
