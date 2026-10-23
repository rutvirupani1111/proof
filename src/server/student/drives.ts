/**
 * College placement drives as ONE student sees them: drives run by their own college that are
 * planned / open, plus any drive they are already on the roster of (so results stay visible after
 * a drive completes). Always pass the session user's id.
 */
import "server-only";
import { and, desc, eq, gt, inArray, or } from "drizzle-orm";
import { getDb } from "@/db";
import { driveStudents, drives, profileSkills, skills, studentProfiles, type DriveEligibility } from "@/db/schema";
import { eligibilityWhere } from "@/server/college/queries";

export type DriveCriterion = { label: string; met: boolean };

export type StudentDrive = {
  id: string;
  title: string;
  companyName: string;
  scheduledAt: string | null;
  location: string | null;
  status: "planned" | "open" | "completed" | "cancelled";
  criteria: DriveCriterion[];
  eligible: boolean;
  /** Roster status for this student, or null when not on the roster yet. */
  rosterStatus: "eligible" | "registered" | "shortlisted" | "selected" | "rejected" | "absent" | null;
  result: string | null;
  canRegister: boolean;
};

/** Plain-language criteria with pass/fail for one student (display only; registration re-checks in SQL). */
export function evaluateCriteria(
  e: DriveEligibility,
  me: { proofScore: number; graduationYear: number | null; branch: string | null; verifiedSkillSlugs: Set<string> },
  skillNames: Map<string, string>,
): DriveCriterion[] {
  const out: DriveCriterion[] = [];
  if (e.minProofScore) out.push({ label: `Proof Score ${e.minProofScore}+ (you: ${me.proofScore})`, met: me.proofScore >= e.minProofScore });
  if (e.graduationYears?.length)
    out.push({ label: `Graduating ${e.graduationYears.join(" / ")}`, met: me.graduationYear != null && e.graduationYears.includes(me.graduationYear) });
  if (e.branches?.length) out.push({ label: e.branches.join(" / "), met: !!me.branch && e.branches.includes(me.branch) });
  for (const slug of e.skills ?? []) out.push({ label: `Verified ${skillNames.get(slug) ?? slug}`, met: me.verifiedSkillSlugs.has(slug) });
  return out;
}

export async function getStudentDrives(userId: string): Promise<StudentDrive[]> {
  const db = await getDb();
  const profile = await db.query.studentProfiles.findFirst({
    where: eq(studentProfiles.userId, userId),
    columns: { collegeId: true, proofScore: true, graduationYear: true, branch: true },
  });
  if (!profile?.collegeId) return [];
  const collegeId = profile.collegeId;

  const roster = await db
    .select({ driveId: driveStudents.driveId, status: driveStudents.status, result: driveStudents.result })
    .from(driveStudents)
    .where(eq(driveStudents.studentUserId, userId));
  const rosterBy = new Map(roster.map((r) => [r.driveId, r]));

  const rows = await db
    .select()
    .from(drives)
    .where(
      and(
        eq(drives.collegeId, collegeId),
        rosterBy.size
          ? or(inArray(drives.status, ["planned", "open"]), inArray(drives.id, [...rosterBy.keys()]))
          : inArray(drives.status, ["planned", "open"]),
      ),
    )
    .orderBy(desc(drives.scheduledAt))
    .limit(40);
  if (!rows.length) return [];

  const mySkills = await db
    .select({ slug: skills.slug })
    .from(profileSkills)
    .innerJoin(skills, eq(skills.id, profileSkills.skillId))
    .where(and(eq(profileSkills.userId, userId), gt(profileSkills.proofScore, 0)));
  const wanted = [...new Set(rows.flatMap((d) => d.eligibility?.skills ?? []))];
  const skillRows = wanted.length ? await db.select({ slug: skills.slug, name: skills.name }).from(skills).where(inArray(skills.slug, wanted)) : [];
  const skillNames = new Map(skillRows.map((s) => [s.slug, s.name]));
  const me = {
    proofScore: profile.proofScore,
    graduationYear: profile.graduationYear,
    branch: profile.branch,
    verifiedSkillSlugs: new Set(mySkills.map((s) => s.slug)),
  };

  return rows.map((d) => {
    const criteria = evaluateCriteria(d.eligibility ?? {}, me, skillNames);
    const eligible = criteria.every((c) => c.met);
    const r = rosterBy.get(d.id);
    const open = d.status === "planned" || d.status === "open";
    return {
      id: d.id,
      title: d.title,
      companyName: d.companyName,
      scheduledAt: d.scheduledAt?.toISOString() ?? null,
      location: d.location,
      status: d.status,
      criteria,
      eligible,
      rosterStatus: r?.status ?? null,
      result: r?.result ?? null,
      canRegister: open && eligible && (!r || r.status === "eligible"),
    };
  });
}

/**
 * Register the student for a drive of THEIR college. Eligibility is re-checked with the same SQL
 * predicate the placement cell uses (`eligibilityWhere`), never trusted from the client.
 */
export async function registerForDrive(userId: string, driveId: string): Promise<{ ok: true; drive: { title: string; companyName: string; createdByUserId: string | null } } | { ok: false; error: string }> {
  const db = await getDb();
  const profile = await db.query.studentProfiles.findFirst({ where: eq(studentProfiles.userId, userId), columns: { collegeId: true } });
  if (!profile?.collegeId) return { ok: false, error: "Join your college in onboarding first." };
  const drive = await db.query.drives.findFirst({ where: and(eq(drives.id, driveId), eq(drives.collegeId, profile.collegeId)) });
  if (!drive) return { ok: false, error: "That drive is not run by your college." };
  if (drive.status !== "planned" && drive.status !== "open") return { ok: false, error: "Registration for this drive is closed." };

  const e = drive.eligibility ?? {};
  const skillIds = e.skills?.length ? (await db.select({ id: skills.id }).from(skills).where(inArray(skills.slug, e.skills))).map((r) => r.id) : [];
  const ok = await db
    .select({ userId: studentProfiles.userId })
    .from(studentProfiles)
    .where(and(eligibilityWhere({ userId, collegeId: profile.collegeId }, e, skillIds), eq(studentProfiles.userId, userId)))
    .limit(1);
  if (!ok.length) return { ok: false, error: "Your verified evidence does not meet this drive's bar yet." };

  const existing = await db.query.driveStudents.findFirst({
    where: and(eq(driveStudents.driveId, drive.id), eq(driveStudents.studentUserId, userId)),
    columns: { id: true, status: true },
  });
  if (existing && existing.status !== "eligible") return { ok: false, error: "You are already registered for this drive." };
  if (existing) {
    await db.update(driveStudents).set({ status: "registered" }).where(eq(driveStudents.id, existing.id));
  } else {
    await db.insert(driveStudents).values({ driveId: drive.id, studentUserId: userId, status: "registered" }).onConflictDoNothing();
  }
  return { ok: true, drive: { title: drive.title, companyName: drive.companyName, createdByUserId: drive.createdByUserId } };
}
