"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fieldErrors } from "@/lib/validation/auth";
import { driveCreateSchema, driveStatusSchema, driveStudentUpdateSchema, nudgeSchema } from "@/lib/validation/college";
import type { ActionResult } from "@/lib/validation/recruiter";
import { AuthError, assertRole } from "@/server/auth/guard";
import { ScopeError } from "@/server/recruiter/scope";
import * as m from "./mutations";
import { collegeScopeOf, type CollegeScope } from "./scope";

/** Role check + session scope + Zod parse + uniform error mapping for every placement-cell action. */
async function run<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  fn: (scope: CollegeScope, data: z.infer<S>) => Promise<T>,
  revalidate: string[] = [],
): Promise<ActionResult<T>> {
  try {
    const user = await assertRole("college");
    const scope = collegeScopeOf(user);
    if (!scope) return { ok: false, error: "Link your college first." };
    const parsed = schema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
    const data = await fn(scope, parsed.data);
    for (const p of revalidate) revalidatePath(p);
    return { ok: true, data };
  } catch (err) {
    if (err instanceof AuthError || err instanceof ScopeError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function createDriveAction(input: unknown) {
  return run(driveCreateSchema, input, m.createDrive, ["/college/drives", "/college"]);
}

export async function setDriveStatusAction(input: unknown) {
  return run(driveStatusSchema, input, (s, d) => m.setDriveStatus(s, d.driveId, d.status), ["/college/drives"]);
}

export async function syncEligibleAction(driveId: unknown) {
  return run(z.string().trim().min(1).max(64), driveId, m.syncEligible, ["/college/drives"]);
}

export async function updateDriveStudentAction(input: unknown) {
  return run(driveStudentUpdateSchema, input, m.updateDriveStudent, ["/college/stats"]);
}

export async function nudgeStudentsAction(input: unknown) {
  return run(nudgeSchema, input, (s, d) => m.nudgeStudents(s, d.studentUserIds, d.message));
}
