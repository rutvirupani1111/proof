import "server-only";
import { and, asc, avg, count, desc, eq, gte, inArray, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import {
  applications,
  colleges,
  companies,
  driveStudents,
  drives,
  jobs,
  profileSkills,
  skills,
  studentProfiles,
  users,
  type DriveEligibility,
} from "@/db/schema";
import type { NudgeGap } from "@/lib/validation/college";
import { factsSql } from "@/server/search/engine";
import type { CollegeScope } from "./scope";

const sp = studentProfiles;

/** Cohort summary scoped to the placement officer's college. */
export async function getCollegeDashboard(collegeId: string | null | undefined) {
  if (!collegeId) return null;
  const db = await getDb();
  const [college, [cohort], [ready], [planned]] = await Promise.all([
    db.query.colleges.findFirst({ where: eq(colleges.id, collegeId) }),
    db.select({ n: count(), avgScore: avg(sp.proofScore) }).from(sp).where(eq(sp.collegeId, collegeId)),
    db.select({ n: count() }).from(sp).where(and(eq(sp.collegeId, collegeId), gte(sp.proofScore, 70))),
    db.select({ n: count() }).from(drives).where(eq(drives.collegeId, collegeId)),
  ]);
  return {
    college: college ?? null,
    students: cohort?.n ?? 0,
    avgScore: Math.round(Number(cohort?.avgScore ?? 0)),
    jobReady: ready?.n ?? 0,
    drives: planned?.n ?? 0,
  };
}

export async function getCollege(scope: CollegeScope) {
  const db = await getDb();
  return (await db.query.colleges.findFirst({ where: eq(colleges.id, scope.collegeId) })) ?? null;
}

/** Every student of this college with their evidence facts. Never crosses colleges. */
export async function getCohortStudents(scope: CollegeScope) {
  const db = await getDb();
  const rows = await db
    .select({
      userId: sp.userId,
      name: users.name,
      image: users.image,
      handle: sp.handle,
      graduationYear: sp.graduationYear,
      branch: sp.branch,
      proofScore: sp.proofScore,
      visibility: sp.visibility,
      githubVerified: factsSql.githubVerified,
      verifiedRepos: factsSql.verifiedRepos,
      liveDeployments: factsSql.liveDeployments,
      passedChecks: factsSql.passedChecks,
      endorsements: factsSql.endorsements,
    })
    .from(sp)
    .innerJoin(users, eq(users.id, sp.userId))
    .where(eq(sp.collegeId, scope.collegeId))
    .orderBy(desc(sp.proofScore));
  return rows.map((r) => {
    const gaps: NudgeGap[] = [];
    if (!r.githubVerified) gaps.push("github");
    if (Number(r.verifiedRepos) === 0) gaps.push("repo");
    if (Number(r.liveDeployments) === 0) gaps.push("deployment");
    if (Number(r.passedChecks) === 0) gaps.push("check");
    if (Number(r.endorsements) === 0) gaps.push("endorsement");
    return {
      ...r,
      githubVerified: Boolean(r.githubVerified),
      verifiedRepos: Number(r.verifiedRepos),
      liveDeployments: Number(r.liveDeployments),
      passedChecks: Number(r.passedChecks),
      endorsements: Number(r.endorsements),
      gaps,
    };
  });
}
export type CohortStudent = Awaited<ReturnType<typeof getCohortStudents>>[number];

export const READY_SCORE = 70;

/** Cohort analytics: verified skill distribution, readiness funnel, top skill gaps vs open jobs. */
export async function getCohortAnalytics(scope: CollegeScope) {
  const db = await getDb();
  const [students, skillRows, openJobs] = await Promise.all([
    getCohortStudents(scope),
    db
      .select({
        slug: skills.slug,
        name: skills.name,
        category: skills.category,
        students: count(profileSkills.id),
        avgScore: avg(profileSkills.proofScore),
        strong: sql<number>`count(*) filter (where ${profileSkills.proofScore} >= ${READY_SCORE})::int`,
      })
      .from(profileSkills)
      .innerJoin(skills, eq(skills.id, profileSkills.skillId))
      .innerJoin(sp, eq(sp.userId, profileSkills.userId))
      .where(and(eq(sp.collegeId, scope.collegeId), gte(profileSkills.proofScore, 1)))
      .groupBy(skills.id)
      .orderBy(desc(count(profileSkills.id))),
    db.select({ requiredSkills: jobs.requiredSkills }).from(jobs).where(eq(jobs.status, "open")),
  ]);

  const total = students.length;
  const funnel = [
    { key: "enrolled", label: "On Proof", n: total },
    { key: "github", label: "GitHub proven", n: students.filter((s) => s.githubVerified).length },
    { key: "repo", label: "Authored code", n: students.filter((s) => s.verifiedRepos > 0).length },
    { key: "deployment", label: "Live deployment", n: students.filter((s) => s.liveDeployments > 0).length },
    { key: "check", label: "Passed a check", n: students.filter((s) => s.passedChecks > 0).length },
    { key: "endorsement", label: "Mentor-endorsed", n: students.filter((s) => s.endorsements > 0).length },
    { key: "ready", label: `Job-ready (${READY_SCORE}+)`, n: students.filter((s) => s.proofScore >= READY_SCORE).length },
  ];

  const distribution = skillRows.map((r) => ({
    slug: r.slug,
    name: r.name,
    category: r.category,
    students: Number(r.students),
    strong: Number(r.strong),
    avgScore: Math.round(Number(r.avgScore ?? 0)),
  }));

  // Demand: how many open jobs need each skill, and at what bar. Supply: cohort students at that bar.
  const demand = new Map<string, { jobs: number; bars: number[] }>();
  for (const j of openJobs) {
    for (const req of j.requiredSkills ?? []) {
      const d = demand.get(req.skillSlug) ?? { jobs: 0, bars: [] };
      d.jobs += 1;
      d.bars.push(req.minScore);
      demand.set(req.skillSlug, d);
    }
  }
  const slugs = [...demand.keys()];
  const supplyRows = slugs.length
    ? await db
        .select({ slug: skills.slug, name: skills.name, userId: profileSkills.userId, score: profileSkills.proofScore })
        .from(profileSkills)
        .innerJoin(skills, eq(skills.id, profileSkills.skillId))
        .innerJoin(sp, eq(sp.userId, profileSkills.userId))
        .where(and(eq(sp.collegeId, scope.collegeId), inArray(skills.slug, slugs)))
    : [];
  const names = new Map<string, string>();
  const allSkills = slugs.length ? await db.select({ slug: skills.slug, name: skills.name }).from(skills).where(inArray(skills.slug, slugs)) : [];
  for (const s of allSkills) names.set(s.slug, s.name);
  const gaps = slugs
    .map((slug) => {
      const d = demand.get(slug)!;
      const bar = Math.round(d.bars.reduce((a, b) => a + b, 0) / d.bars.length);
      const ready = supplyRows.filter((r) => r.slug === slug && r.score >= bar).length;
      const share = total ? ready / total : 0;
      return { slug, name: names.get(slug) ?? slug, jobs: d.jobs, bar, ready, share, gap: d.jobs * (1 - share) };
    })
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 6);

  return { total, funnel, distribution, gaps, students };
}

/* ---------------------------------------------------------------- drives */

export async function getDrives(scope: CollegeScope) {
  const db = await getDb();
  const rows = await db
    .select({
      drive: drives,
      total: count(driveStudents.id),
      registered: sql<number>`count(*) filter (where ${driveStudents.status} in ('registered','shortlisted','selected','rejected','absent'))::int`,
      selected: sql<number>`count(*) filter (where ${driveStudents.status} = 'selected')::int`,
    })
    .from(drives)
    .leftJoin(driveStudents, eq(driveStudents.driveId, drives.id))
    .where(eq(drives.collegeId, scope.collegeId))
    .groupBy(drives.id)
    .orderBy(desc(drives.scheduledAt));
  const now = Date.now();
  return rows.map((r) => ({
    ...r.drive,
    daysAway: r.drive.scheduledAt ? Math.round((r.drive.scheduledAt.getTime() - now) / 86_400_000) : null,
    total: Number(r.total),
    registered: Number(r.registered),
    selected: Number(r.selected),
  }));
}
export type CollegeDrive = Awaited<ReturnType<typeof getDrives>>[number];

/** WHERE for "students of this college who meet a drive's eligibility". */
export function eligibilityWhere(scope: CollegeScope, e: DriveEligibility, skillIds: string[]): SQL {
  const conds: SQL[] = [eq(sp.collegeId, scope.collegeId)];
  if (e.minProofScore) conds.push(gte(sp.proofScore, e.minProofScore));
  if (e.graduationYears?.length) conds.push(inArray(sp.graduationYear, e.graduationYears));
  if (e.branches?.length) conds.push(inArray(sp.branch, e.branches));
  if (e.skills?.length && skillIds.length < e.skills.length) conds.push(sql`false`);
  for (const id of skillIds) {
    conds.push(sql`exists (select 1 from "profile_skills" ps where ps.user_id = ${sp.userId} and ps.skill_id = ${id} and ps.proof_score > 0)`);
  }
  return and(...conds)!;
}

export async function eligibleStudentIds(scope: CollegeScope, e: DriveEligibility): Promise<string[]> {
  const db = await getDb();
  const skillIds = e.skills?.length
    ? (await db.select({ id: skills.id }).from(skills).where(inArray(skills.slug, e.skills))).map((r) => r.id)
    : [];
  const rows = await db.select({ userId: sp.userId }).from(sp).where(eligibilityWhere(scope, e, skillIds));
  return rows.map((r) => r.userId);
}

/** One drive with its students. `null` when the drive belongs to another college. */
export async function getDrive(scope: CollegeScope, driveId: string) {
  const db = await getDb();
  const drive = await db.query.drives.findFirst({
    where: and(eq(drives.id, driveId), eq(drives.collegeId, scope.collegeId)),
  });
  if (!drive) return null;
  const [roster, eligibleIds] = await Promise.all([
    db
      .select({
        studentUserId: driveStudents.studentUserId,
        status: driveStudents.status,
        result: driveStudents.result,
        name: users.name,
        image: users.image,
        handle: sp.handle,
        branch: sp.branch,
        graduationYear: sp.graduationYear,
        proofScore: sp.proofScore,
      })
      .from(driveStudents)
      .innerJoin(users, eq(users.id, driveStudents.studentUserId))
      .innerJoin(sp, eq(sp.userId, driveStudents.studentUserId))
      .where(and(eq(driveStudents.driveId, drive.id), eq(sp.collegeId, scope.collegeId)))
      .orderBy(desc(sp.proofScore)),
    eligibleStudentIds(scope, drive.eligibility ?? {}),
  ]);
  const onRoster = new Set(roster.map((r) => r.studentUserId));
  return { drive, roster, newlyEligible: eligibleIds.filter((id) => !onRoster.has(id)).length };
}

/** Filter options for the drive form (this college's branches and years). */
export async function getCohortFacets(scope: CollegeScope) {
  const db = await getDb();
  const [branches, years, skillRows] = await Promise.all([
    db.selectDistinct({ v: sp.branch }).from(sp).where(eq(sp.collegeId, scope.collegeId)).orderBy(asc(sp.branch)),
    db.selectDistinct({ v: sp.graduationYear }).from(sp).where(eq(sp.collegeId, scope.collegeId)).orderBy(asc(sp.graduationYear)),
    db.select({ slug: skills.slug, name: skills.name }).from(skills).orderBy(asc(skills.name)),
  ]);
  return {
    branches: branches.map((b) => b.v).filter((v): v is string => !!v),
    years: years.map((y) => y.v).filter((v): v is number => v != null),
    skills: skillRows,
  };
}

/* ---------------------------------------------------------------- placement stats */

export type PlacementRow = {
  studentUserId: string;
  name: string;
  handle: string;
  branch: string | null;
  graduationYear: number | null;
  proofScore: number;
  company: string;
  source: "drive" | "application";
  result: string | null;
};

/** Placements = drive selections + offers/hires on Proof job applications, this college only. */
export async function getPlacementStats(scope: CollegeScope) {
  const db = await getDb();
  const [students, driveRows, appRows] = await Promise.all([
    getCohortStudents(scope),
    db
      .select({
        studentUserId: driveStudents.studentUserId,
        name: users.name,
        handle: sp.handle,
        branch: sp.branch,
        graduationYear: sp.graduationYear,
        proofScore: sp.proofScore,
        company: drives.companyName,
        result: driveStudents.result,
      })
      .from(driveStudents)
      .innerJoin(drives, eq(drives.id, driveStudents.driveId))
      .innerJoin(users, eq(users.id, driveStudents.studentUserId))
      .innerJoin(sp, eq(sp.userId, driveStudents.studentUserId))
      .where(and(eq(drives.collegeId, scope.collegeId), eq(sp.collegeId, scope.collegeId), eq(driveStudents.status, "selected"))),
    db
      .select({
        studentUserId: applications.studentUserId,
        name: users.name,
        handle: sp.handle,
        branch: sp.branch,
        graduationYear: sp.graduationYear,
        proofScore: sp.proofScore,
        company: companies.name,
        stage: applications.stage,
      })
      .from(applications)
      .innerJoin(jobs, eq(jobs.id, applications.jobId))
      .innerJoin(companies, eq(companies.id, jobs.companyId))
      .innerJoin(users, eq(users.id, applications.studentUserId))
      .innerJoin(sp, eq(sp.userId, applications.studentUserId))
      .where(and(eq(sp.collegeId, scope.collegeId), inArray(applications.stage, ["offer", "hired"]))),
  ]);

  const placements: PlacementRow[] = [
    ...driveRows.map((r) => ({ ...r, source: "drive" as const })),
    ...appRows.map(({ stage, ...r }) => ({ ...r, source: "application" as const, result: stage === "hired" ? "Hired" : "Offer" })),
  ];
  const placedIds = new Set(placements.map((p) => p.studentUserId));

  const groups = new Map<string, { branch: string; year: number | null; students: number; placed: number; scoreSum: number }>();
  for (const s of students) {
    const key = `${s.branch ?? "Unspecified"}|${s.graduationYear ?? ""}`;
    const g = groups.get(key) ?? { branch: s.branch ?? "Unspecified", year: s.graduationYear, students: 0, placed: 0, scoreSum: 0 };
    g.students += 1;
    g.scoreSum += s.proofScore;
    if (placedIds.has(s.userId)) g.placed += 1;
    groups.set(key, g);
  }
  const byGroup = [...groups.values()]
    .map((g) => ({ branch: g.branch, year: g.year, students: g.students, placed: g.placed, avgScore: Math.round(g.scoreSum / g.students), rate: g.students ? g.placed / g.students : 0 }))
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || a.branch.localeCompare(b.branch));

  const companyCounts = new Map<string, number>();
  for (const p of placements) companyCounts.set(p.company, (companyCounts.get(p.company) ?? 0) + 1);

  const placedScores = students.filter((s) => placedIds.has(s.userId)).map((s) => s.proofScore);
  const otherScores = students.filter((s) => !placedIds.has(s.userId)).map((s) => s.proofScore);
  const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

  return {
    totals: {
      students: students.length,
      placed: placedIds.size,
      offers: placements.length,
      companies: companyCounts.size,
      avgScorePlaced: mean(placedScores),
      avgScoreOthers: mean(otherScores),
    },
    byGroup,
    companies: [...companyCounts.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n),
    placements: placements.sort((a, b) => b.proofScore - a.proofScore),
  };
}

/** RFC 4180 CSV for the placements export. */
export function placementsCsv(rows: PlacementRow[]): string {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    // Neutralise spreadsheet formula injection, then quote.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const header = ["Name", "Handle", "Branch", "Graduation year", "Proof Score", "Company", "Source", "Result"];
  const lines = rows.map((r) =>
    [r.name, r.handle, r.branch, r.graduationYear, r.proofScore, r.company, r.source, r.result].map(esc).join(","),
  );
  return [header.join(","), ...lines].join("\r\n") + "\r\n";
}
