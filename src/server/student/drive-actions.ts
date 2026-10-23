"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { notifications } from "@/db/schema";
import { driveRegistrationSchema } from "@/lib/validation/student";
import { AuthError, assertRole } from "@/server/auth/guard";
import { registerForDrive } from "./drives";

/** Register the signed-in student for one of their college's drives. */
export async function registerForDriveAction(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  let user;
  try {
    user = await assertRole("student");
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: "Sign in as a student to register." };
    throw err;
  }
  const parsed = driveRegistrationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unknown drive." };
  const res = await registerForDrive(user.id, parsed.data.driveId);
  if (!res.ok) return res;
  if (res.drive.createdByUserId) {
    const db = await getDb();
    await db.insert(notifications).values({
      userId: res.drive.createdByUserId,
      type: "drive.registrations",
      title: `${user.name} registered for ${res.drive.companyName}`,
      body: res.drive.title,
      href: `/college/drives/${parsed.data.driveId}`,
    });
  }
  revalidatePath("/student/jobs");
  revalidatePath(`/college/drives/${parsed.data.driveId}`);
  return { ok: true };
}
