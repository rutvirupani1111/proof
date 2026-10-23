"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { applications, jobs, notifications, type ApplicationStage } from "@/db/schema";
import { fieldErrors } from "@/lib/validation/auth";
import { applySchema, withdrawSchema } from "@/lib/validation/student";
import { AuthError, assertRole } from "@/server/auth/guard";

export type JobActionResult =
  | { ok: true; applicationId: string }
  | { ok: false; errors: Record<string, string> };

const fail = (message: string, field = "form"): JobActionResult => ({ ok: false, errors: { [field]: message } });

async function student() {
  try {
    return await assertRole("student");
  } catch (err) {
    if (err instanceof AuthError) return null;
    throw err;
  }
}

/** Apply to an open job with an optional cover note. One application per job per student. */
export async function applyToJob(input: unknown): Promise<JobActionResult> {
  const user = await student();
  if (!user) return fail("Sign in as a student to apply.");
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const db = await getDb();

  const job = await db.query.jobs.findFirst({
    where: eq(jobs.id, parsed.data.jobId),
    columns: { id: true, title: true, status: true, postedByUserId: true, applyBy: true },
  });
  if (!job || job.status !== "open") return fail("This job is no longer accepting applications.");
  if (job.applyBy && job.applyBy.getTime() < Date.now()) return fail("Applications for this job have closed.");

  const existing = await db.query.applications.findFirst({
    where: and(eq(applications.jobId, job.id), eq(applications.studentUserId, user.id)),
    columns: { id: true, stage: true },
  });
  if (existing && existing.stage !== "withdrawn") return fail("You have already applied to this job.");

  const coverNote = parsed.data.coverNote?.trim() || null;
  let applicationId: string;
  if (existing) {
    // Re-applying after a withdrawal reopens the same application.
    await db
      .update(applications)
      .set({ stage: "applied", coverNote, appliedAt: new Date() })
      .where(eq(applications.id, existing.id));
    applicationId = existing.id;
  } else {
    const [row] = await db
      .insert(applications)
      .values({ jobId: job.id, studentUserId: user.id, coverNote })
      .onConflictDoNothing({ target: [applications.jobId, applications.studentUserId] })
      .returning({ id: applications.id });
    if (!row) return fail("You have already applied to this job.");
    applicationId = row.id;
  }

  if (job.postedByUserId) {
    await db.insert(notifications).values({
      userId: job.postedByUserId,
      type: "application.new",
      title: `${user.name} applied to ${job.title}`,
      body: "Their verified evidence is on their Proof profile.",
      href: "/recruiter/pipeline",
    });
  }
  revalidatePath("/student/jobs");
  revalidatePath("/student/applications");
  revalidatePath("/student");
  return { ok: true, applicationId };
}

const WITHDRAWABLE: ApplicationStage[] = ["applied", "screening", "skill_check", "interview"];

/** Withdraw an application before an offer. Scoped to the session student's own rows. */
export async function withdrawApplication(input: unknown): Promise<JobActionResult> {
  const user = await student();
  if (!user) return fail("Sign in as a student to manage applications.");
  const parsed = withdrawSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const db = await getDb();
  const app = await db.query.applications.findFirst({
    where: and(eq(applications.id, parsed.data.applicationId), eq(applications.studentUserId, user.id)),
    columns: { id: true, stage: true },
  });
  if (!app) return fail("Application not found.");
  if (!WITHDRAWABLE.includes(app.stage)) return fail("This application can no longer be withdrawn.");
  await db
    .update(applications)
    .set({ stage: "withdrawn" })
    .where(and(eq(applications.id, app.id), eq(applications.studentUserId, user.id)));
  revalidatePath("/student/applications");
  revalidatePath("/student/jobs");
  return { ok: true, applicationId: app.id };
}
