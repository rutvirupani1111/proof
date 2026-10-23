"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { colleges, evidence, profileSkills, skills, studentProfiles, users } from "@/db/schema";
import { fieldErrors } from "@/lib/validation/auth";
import {
  onboardingCollegeSchema,
  onboardingRolesSchema,
  onboardingSkillsSchema,
  profileSchema,
} from "@/lib/validation/student";
import { AuthError, assertRole } from "@/server/auth/guard";
import { rebuildSearchText } from "./profile";

export type ActionResult = { ok: true } | { ok: false; errors: Record<string, string> };

function fail(message: string, field = "form"): ActionResult {
  return { ok: false, errors: { [field]: message } };
}

async function student() {
  try {
    return await assertRole("student");
  } catch (err) {
    if (err instanceof AuthError) return null;
    throw err;
  }
}

/** Step 1: college, graduation year, degree, branch. */
export async function saveOnboardingCollege(input: unknown): Promise<ActionResult> {
  const user = await student();
  if (!user) return fail("Sign in as a student to continue.");
  const parsed = onboardingCollegeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const db = await getDb();
  const college = await db.query.colleges.findFirst({
    where: eq(colleges.id, parsed.data.collegeId),
    columns: { id: true, city: true },
  });
  if (!college) return fail("Choose a college from the list.", "collegeId");
  const profile = await db.query.studentProfiles.findFirst({
    where: eq(studentProfiles.userId, user.id),
    columns: { onboardingStep: true, location: true },
  });
  if (!profile) return fail("Your student profile is missing. Try signing in again.");
  await db
    .update(studentProfiles)
    .set({
      collegeId: college.id,
      graduationYear: parsed.data.graduationYear,
      degree: parsed.data.degree,
      branch: parsed.data.branch,
      location: profile.location ?? college.city,
      onboardingStep: Math.max(profile.onboardingStep, 1),
    })
    .where(eq(studentProfiles.userId, user.id));
  revalidatePath("/student", "layout");
  return { ok: true };
}

/** Step 2: target roles. */
export async function saveOnboardingRoles(input: unknown): Promise<ActionResult> {
  const user = await student();
  if (!user) return fail("Sign in as a student to continue.");
  const parsed = onboardingRolesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const db = await getDb();
  const profile = await db.query.studentProfiles.findFirst({
    where: eq(studentProfiles.userId, user.id),
    columns: { onboardingStep: true },
  });
  if (!profile) return fail("Your student profile is missing.");
  const roles = [...new Set(parsed.data.targetRoles.map((r) => r.trim()))];
  await db
    .update(studentProfiles)
    .set({ targetRoles: roles, onboardingStep: Math.max(profile.onboardingStep, 2) })
    .where(eq(studentProfiles.userId, user.id));
  return { ok: true };
}

/**
 * Step 3: skills to prove. Claims are upserted without touching the scoring engine's columns;
 * skills un-picked here keep their row (the engine may have scored them) but lose the claim.
 */
export async function saveOnboardingSkills(input: unknown): Promise<ActionResult> {
  const user = await student();
  if (!user) return fail("Sign in as a student to continue.");
  const parsed = onboardingSkillsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const db = await getDb();
  const ids = [...new Set(parsed.data.skillIds)];
  const valid = await db.select({ id: skills.id }).from(skills).where(inArray(skills.id, ids));
  if (valid.length !== ids.length) return fail("One of those skills no longer exists.", "skillIds");

  for (const { id: skillId } of valid) {
    await db
      .insert(profileSkills)
      .values({ userId: user.id, skillId, claimed: true })
      .onConflictDoUpdate({ target: [profileSkills.userId, profileSkills.skillId], set: { claimed: true } });
  }
  const existing = await db
    .select({ id: profileSkills.id, skillId: profileSkills.skillId })
    .from(profileSkills)
    .where(and(eq(profileSkills.userId, user.id), eq(profileSkills.claimed, true)));
  const unpicked = existing.filter((r) => !ids.includes(r.skillId)).map((r) => r.id);
  if (unpicked.length) {
    await db.update(profileSkills).set({ claimed: false }).where(inArray(profileSkills.id, unpicked));
  }
  const profile = await db.query.studentProfiles.findFirst({
    where: eq(studentProfiles.userId, user.id),
    columns: { onboardingStep: true },
  });
  await db
    .update(studentProfiles)
    .set({ onboardingStep: Math.max(profile?.onboardingStep ?? 0, 3) })
    .where(eq(studentProfiles.userId, user.id));
  return { ok: true };
}

/** Step 4: done. */
export async function finishOnboarding(): Promise<ActionResult> {
  const user = await student();
  if (!user) return fail("Sign in as a student to continue.");
  const db = await getDb();
  const profile = await db.query.studentProfiles.findFirst({
    where: eq(studentProfiles.userId, user.id),
    columns: { collegeId: true, targetRoles: true },
  });
  if (!profile?.collegeId) return fail("Add your college first.");
  if (profile.targetRoles.length === 0) return fail("Pick at least one target role first.");
  await db.update(studentProfiles).set({ onboardingStep: 4 }).where(eq(studentProfiles.userId, user.id));
  await db.update(users).set({ onboardedAt: new Date() }).where(eq(users.id, user.id));
  await rebuildSearchText(user.id);
  revalidatePath("/student", "layout");
  return { ok: true };
}

/** Profile builder save: public dossier fields, pinned evidence and privacy. */
export async function saveProfile(input: unknown): Promise<ActionResult> {
  const user = await student();
  if (!user) return fail("Sign in as a student to save your profile.");
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const data = parsed.data;
  const db = await getDb();

  // Only the student's own VERIFIED evidence may be pinned.
  const pinned = [...new Set(data.pinnedEvidenceIds)];
  if (pinned.length) {
    const owned = await db
      .select({ id: evidence.id })
      .from(evidence)
      .where(and(eq(evidence.userId, user.id), eq(evidence.status, "verified"), inArray(evidence.id, pinned)));
    if (owned.length !== pinned.length) return fail("You can only pin your own verified evidence.", "pinnedEvidenceIds");
  }

  await db
    .update(studentProfiles)
    .set({
      headline: data.headline || null,
      about: data.about || null,
      location: data.location || null,
      targetRoles: [...new Set(data.targetRoles)],
      openToWork: data.openToWork,
      accentColor: data.accentColor,
      visibility: data.visibility,
      pinnedEvidenceIds: pinned,
    })
    .where(eq(studentProfiles.userId, user.id));
  await rebuildSearchText(user.id);
  const profile = await db.query.studentProfiles.findFirst({
    where: eq(studentProfiles.userId, user.id),
    columns: { handle: true },
  });
  revalidatePath("/student/profile");
  if (profile) revalidatePath(`/u/${profile.handle}`);
  return { ok: true };
}
