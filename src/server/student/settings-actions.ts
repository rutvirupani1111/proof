"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { studentProfiles, users } from "@/db/schema";
import { fieldErrors } from "@/lib/validation/auth";
import { studentAccountSchema, studentNotificationsSchema, studentPrivacySchema } from "@/lib/validation/student";
import { AuthError, assertRole } from "@/server/auth/guard";
import { rebuildSearchText } from "./profile";

export type SettingsResult = { ok: true } | { ok: false; errors: Record<string, string> };

async function student() {
  try {
    return await assertRole("student");
  } catch (err) {
    if (err instanceof AuthError) return null;
    throw err;
  }
}

const signedOut: SettingsResult = { ok: false, errors: { form: "Sign in as a student to change settings." } };

/** Account: display name (email and password are handled by Better Auth). */
export async function saveStudentAccount(input: unknown): Promise<SettingsResult> {
  const user = await student();
  if (!user) return signedOut;
  const parsed = studentAccountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const db = await getDb();
  await db.update(users).set({ name: parsed.data.name }).where(eq(users.id, user.id));
  await rebuildSearchText(user.id);
  revalidatePath("/student", "layout");
  return { ok: true };
}

/** Privacy: who can open the dossier, and whether recruiters see "open to work". */
export async function saveStudentPrivacy(input: unknown): Promise<SettingsResult> {
  const user = await student();
  if (!user) return signedOut;
  const parsed = studentPrivacySchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const db = await getDb();
  const [row] = await db
    .update(studentProfiles)
    .set({ visibility: parsed.data.visibility, openToWork: parsed.data.openToWork })
    .where(eq(studentProfiles.userId, user.id))
    .returning({ handle: studentProfiles.handle });
  if (!row) return { ok: false, errors: { form: "Your student profile is missing. Try signing in again." } };
  revalidatePath("/student", "layout");
  revalidatePath(`/u/${row.handle}`);
  return { ok: true };
}

/** Notifications: categories muted from the bell. */
export async function saveStudentNotifications(input: unknown): Promise<SettingsResult> {
  const user = await student();
  if (!user) return signedOut;
  const parsed = studentNotificationsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const db = await getDb();
  await db
    .update(studentProfiles)
    .set({ mutedNotifications: [...new Set(parsed.data.muted)] })
    .where(eq(studentProfiles.userId, user.id));
  revalidatePath("/student", "layout");
  return { ok: true };
}
