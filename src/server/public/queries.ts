import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { credentials, profileSkills, skills, studentProfiles } from "@/db/schema";
import type { Role } from "@/lib/auth/roles";

/**
 * Public dossier by handle. Visibility rules:
 * public -> anyone; recruiters -> signed-in recruiters/colleges/admins and the owner; hidden -> owner only.
 */
export async function getPublicProfile(handle: string, viewer: { id: string; role: Role } | null) {
  const db = await getDb();
  const profile = await db.query.studentProfiles.findFirst({
    where: eq(studentProfiles.handle, handle.toLowerCase()),
    with: {
      user: { columns: { id: true, name: true, image: true } },
      college: { columns: { name: true, city: true } },
    },
  });
  if (!profile) return null;
  const isOwner = viewer?.id === profile.userId;
  const canSee =
    isOwner ||
    profile.visibility === "public" ||
    (profile.visibility === "recruiters" && !!viewer && ["recruiter", "college", "admin"].includes(viewer.role));
  if (!canSee) return { profile: null, restricted: true as const };

  const topSkills = await db
    .select({ name: skills.name, slug: skills.slug, score: profileSkills.proofScore })
    .from(profileSkills)
    .innerJoin(skills, eq(skills.id, profileSkills.skillId))
    .where(eq(profileSkills.userId, profile.userId))
    .orderBy(desc(profileSkills.proofScore))
    .limit(8);

  return { profile, topSkills, restricted: false as const };
}

/** Credential lookup for /verify/{id}. Signature checking lands with the credential engine. */
export async function getCredentialForVerify(id: string) {
  const db = await getDb();
  return db.query.credentials.findFirst({
    where: eq(credentials.id, id),
    with: { subject: { columns: { name: true } }, evidence: { columns: { title: true, kind: true } } },
  });
}
