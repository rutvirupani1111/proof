/**
 * Onboarding + profile builder reads for ONE student, plus the search_text rebuild.
 * Always pass the session user's id (from requireRole/assertRole), never a client value.
 */
import "server-only";
import { and, asc, desc, eq, gt, or } from "drizzle-orm";
import { getDb } from "@/db";
import { colleges, evidence, profileSkills, repos, skills, studentProfiles, users } from "@/db/schema";

export async function getOnboardingData(userId: string) {
  const db = await getDb();
  const [profile, allColleges, allSkills, claimed] = await Promise.all([
    db.query.studentProfiles.findFirst({ where: eq(studentProfiles.userId, userId) }),
    db
      .select({ id: colleges.id, name: colleges.name, shortName: colleges.shortName, city: colleges.city })
      .from(colleges)
      .orderBy(asc(colleges.name)),
    db
      .select({ id: skills.id, slug: skills.slug, name: skills.name, category: skills.category })
      .from(skills)
      .orderBy(asc(skills.name)),
    db
      .select({ skillId: profileSkills.skillId })
      .from(profileSkills)
      .where(and(eq(profileSkills.userId, userId), eq(profileSkills.claimed, true))),
  ]);
  return {
    profile: profile ?? null,
    colleges: allColleges,
    skills: allSkills,
    claimedSkillIds: claimed.map((c) => c.skillId),
  };
}

export async function getProfileBuilderData(userId: string) {
  const db = await getDb();
  const [profile, user, verified, topSkills] = await Promise.all([
    db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.userId, userId),
      with: { college: { columns: { name: true, shortName: true } } },
    }),
    db.query.users.findFirst({ where: eq(users.id, userId), columns: { name: true, image: true } }),
    db
      .select({
        id: evidence.id,
        kind: evidence.kind,
        title: evidence.title,
        summary: evidence.summary,
        skillSlugs: evidence.skillSlugs,
        verifiedAt: evidence.verifiedAt,
      })
      .from(evidence)
      .where(and(eq(evidence.userId, userId), eq(evidence.status, "verified")))
      .orderBy(desc(evidence.verifiedAt)),
    db
      .select({ name: skills.name, slug: skills.slug, score: profileSkills.proofScore })
      .from(profileSkills)
      .innerJoin(skills, eq(skills.id, profileSkills.skillId))
      .where(and(eq(profileSkills.userId, userId), gt(profileSkills.proofScore, 0)))
      .orderBy(desc(profileSkills.proofScore))
      .limit(6),
  ]);
  return { profile: profile ?? null, user: user ?? null, evidence: verified, topSkills };
}

/**
 * Recruiter full-text search reads student_profiles.search_text. Rebuild it from the name,
 * headline, about, roles, scored or claimed skills and repo names whenever those change.
 */
export async function rebuildSearchText(userId: string) {
  const db = await getDb();
  const [profile, user, skillRows, repoRows] = await Promise.all([
    db.query.studentProfiles.findFirst({ where: eq(studentProfiles.userId, userId) }),
    db.query.users.findFirst({ where: eq(users.id, userId), columns: { name: true } }),
    db
      .select({ name: skills.name, slug: skills.slug })
      .from(profileSkills)
      .innerJoin(skills, eq(skills.id, profileSkills.skillId))
      .where(and(eq(profileSkills.userId, userId), or(gt(profileSkills.proofScore, 0), eq(profileSkills.claimed, true)))),
    db.select({ name: repos.name }).from(repos).where(eq(repos.userId, userId)),
  ]);
  if (!profile) return;
  const parts = [
    user?.name,
    profile.headline,
    profile.about,
    profile.location,
    profile.branch,
    ...profile.targetRoles,
    ...skillRows.flatMap((s) => [s.name, s.slug]),
    ...repoRows.map((r) => r.name.replace(/[-_]/g, " ")),
  ];
  const searchText = [...new Set(parts.filter((p): p is string => !!p && p.trim().length > 0))].join(" ").slice(0, 8000);
  await db.update(studentProfiles).set({ searchText }).where(eq(studentProfiles.userId, userId));
}
