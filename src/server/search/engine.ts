/**
 * Recruiter evidence search. One SQL query over `student_profiles` with correlated EXISTS /
 * sub-selects for the evidence filters, so every filter is enforced by Postgres (PGlite or Neon)
 * and the result count is honest.
 *
 * Privacy is not a filter the caller can turn off: `RECRUITER_VISIBLE` is always ANDed in, so a
 * student whose profile is `hidden` never appears in search, compare or the candidate view.
 */
import "server-only";
import { and, count, desc, eq, gte, ilike, inArray, isNotNull, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { colleges, profileSkills, skills, studentProfiles, users } from "@/db/schema";
import { searchFiltersSchema, type SearchFiltersInput, type SearchSort } from "@/lib/validation/recruiter";

/** Profile visibilities a recruiter may see. `hidden` is never searchable. */
export const RECRUITER_VISIBLE = ["public", "recruiters"] as const;

export type CandidateSkill = { slug: string; name: string; score: number; evidenceCount: number };

export type CandidateHit = {
  userId: string;
  name: string;
  image: string | null;
  handle: string;
  headline: string | null;
  location: string | null;
  graduationYear: number | null;
  branch: string | null;
  collegeId: string | null;
  collegeName: string | null;
  proofScore: number;
  openToWork: boolean;
  liveDeployments: number;
  ownCommits: number;
  passedChecks: number;
  endorsements: number;
  /** Top verified skills (score > 0), best first. */
  skills: CandidateSkill[];
  /** Average score across the filtered skills (0 when no skill filter). */
  skillMatch: number;
};

export type SearchResult = { total: number; hits: CandidateHit[]; filters: SearchFiltersInput };

/* -------------------------------------------------------------------------- */
/* Evidence facts as SQL expressions over the current student_profiles row     */
/* -------------------------------------------------------------------------- */

const sp = studentProfiles;

const liveDeploymentsSql = sql<number>`(select count(*) from "deployments" d where d.user_id = ${sp.userId} and d.status = 'verified')::int`;
const ownCommitsSql = sql<number>`(select coalesce(sum(rs.own_commits), 0) from "repo_stats" rs join "repos" r on r.id = rs.repo_id where r.user_id = ${sp.userId} and r.status = 'verified')::int`;
const passedChecksSql = sql<number>`(select count(*) from "check_attempts" ca where ca.user_id = ${sp.userId} and ca.status = 'passed')::int`;
const endorsementsSql = sql<number>`(select count(*) from "attestations" a join "mentors" m on m.id = a.mentor_id where a.student_user_id = ${sp.userId} and a.status = 'endorsed' and m.domain_verified_at is not null)::int`;

/** Evidence facts as SQL over the current `student_profiles` row (shared with the college cohort). */
export const factsSql = {
  liveDeployments: liveDeploymentsSql,
  ownCommits: ownCommitsSql,
  passedChecks: passedChecksSql,
  endorsements: endorsementsSql,
  githubVerified: sql<boolean>`exists (select 1 from "github_accounts" g where g.user_id = ${sp.userId} and g.status = 'verified')`,
  verifiedRepos: sql<number>`(select count(*) from "repos" r where r.user_id = ${sp.userId} and r.status = 'verified')::int`,
};

/** "reac nod" -> "reac:* & nod:*". Tokens are reduced to [a-z0-9] so the tsquery is always valid. */
export function prefixTsQuery(q: string): string | null {
  const tokens = q
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0)
    .slice(0, 8);
  return tokens.length ? tokens.map((t) => `${t}:*`).join(" & ") : null;
}

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Parse untrusted input (form state, saved-search JSON) into clean filters. */
export function normalizeFilters(input: unknown): SearchFiltersInput {
  const parsed = searchFiltersSchema.safeParse(input ?? {});
  if (!parsed.success) return {};
  const f = parsed.data;
  const clean: SearchFiltersInput = {};
  if (f.q) clean.q = f.q;
  if (f.skills?.length) clean.skills = [...new Set(f.skills.map((s) => s.toLowerCase()))];
  if (f.minScore) clean.minScore = f.minScore;
  if (f.hasDeployment) clean.hasDeployment = true;
  if (f.minOwnCommits) clean.minOwnCommits = f.minOwnCommits;
  if (f.passedCheck) clean.passedCheck = true;
  if (f.mentorEndorsed) clean.mentorEndorsed = true;
  if (f.collegeIds?.length) clean.collegeIds = [...new Set(f.collegeIds)];
  if (f.graduationYears?.length) clean.graduationYears = [...new Set(f.graduationYears)];
  if (f.location) clean.location = f.location;
  if (f.sort) clean.sort = f.sort;
  return clean;
}

/** WHERE clause for a filter set. Visibility is always included. */
export function buildWhere(f: SearchFiltersInput, skillIds: string[]): SQL {
  const conds: (SQL | undefined)[] = [inArray(sp.visibility, [...RECRUITER_VISIBLE])];
  if (f.minScore) conds.push(gte(sp.proofScore, f.minScore));
  if (f.collegeIds?.length) conds.push(inArray(sp.collegeId, f.collegeIds));
  if (f.graduationYears?.length) conds.push(inArray(sp.graduationYear, f.graduationYears));
  if (f.location) conds.push(ilike(sp.location, `%${escapeLike(f.location)}%`));
  if (f.hasDeployment) conds.push(sql`${liveDeploymentsSql} > 0`);
  if (f.passedCheck) conds.push(sql`${passedChecksSql} > 0`);
  if (f.mentorEndorsed) conds.push(sql`${endorsementsSql} > 0`);
  if (f.minOwnCommits) conds.push(sql`${ownCommitsSql} >= ${f.minOwnCommits}`);
  if (f.skills?.length) {
    // Every requested skill must be backed by verified evidence (a non-zero per-skill score).
    // An unknown slug can never match, so it empties the result instead of being ignored.
    if (skillIds.length < f.skills.length) conds.push(sql`false`);
    for (const skillId of skillIds) {
      conds.push(
        sql`exists (select 1 from "profile_skills" ps where ps.user_id = ${sp.userId} and ps.skill_id = ${skillId} and ps.proof_score > 0)`,
      );
    }
  }
  const tsq = f.q ? prefixTsQuery(f.q) : null;
  if (tsq) conds.push(sql`to_tsvector('english', ${sp.searchText}) @@ to_tsquery('english', ${tsq})`);
  return and(...conds)!;
}

function orderFor(sort: SearchSort, f: SearchFiltersInput, skillIds: string[]): SQL[] {
  const skillAvg = skillIds.length
    ? sql`(select coalesce(avg(ps.proof_score), 0) from "profile_skills" ps where ps.user_id = ${sp.userId} and ps.skill_id in (${sql.join(
        skillIds.map((s) => sql`${s}`),
        sql`, `,
      )}))`
    : sql`0`;
  const tsq = f.q ? prefixTsQuery(f.q) : null;
  switch (sort) {
    case "relevance":
      return tsq
        ? [sql`ts_rank(to_tsvector('english', ${sp.searchText}), to_tsquery('english', ${tsq})) desc`, desc(sp.proofScore)]
        : [desc(sp.proofScore)];
    case "skill":
      // A bare `0` in ORDER BY is a column position in Postgres, so never emit it.
      return skillIds.length ? [sql`${skillAvg} desc`, desc(sp.proofScore)] : [desc(sp.proofScore)];
    case "commits":
      return [sql`${ownCommitsSql} desc`, desc(sp.proofScore)];
    case "deployments":
      return [sql`${liveDeploymentsSql} desc`, desc(sp.proofScore)];
    default:
      return [desc(sp.proofScore), sql`${ownCommitsSql} desc`];
  }
}

async function skillIdsFor(slugs: string[] | undefined): Promise<string[]> {
  if (!slugs?.length) return [];
  const db = await getDb();
  const rows = await db.select({ id: skills.id }).from(skills).where(inArray(skills.slug, slugs));
  return rows.map((r) => r.id);
}

/** Load top skills for a set of students (verified skills only, best first). */
export async function skillsFor(userIds: string[], limitPer = 6): Promise<Map<string, CandidateSkill[]>> {
  const out = new Map<string, CandidateSkill[]>();
  if (!userIds.length) return out;
  const db = await getDb();
  const rows = await db
    .select({
      userId: profileSkills.userId,
      slug: skills.slug,
      name: skills.name,
      score: profileSkills.proofScore,
      evidenceCount: profileSkills.evidenceCount,
    })
    .from(profileSkills)
    .innerJoin(skills, eq(skills.id, profileSkills.skillId))
    .where(and(inArray(profileSkills.userId, userIds), gte(profileSkills.proofScore, 1)))
    .orderBy(desc(profileSkills.proofScore));
  for (const r of rows) {
    const list = out.get(r.userId) ?? [];
    if (list.length < limitPer) list.push({ slug: r.slug, name: r.name, score: r.score, evidenceCount: r.evidenceCount });
    out.set(r.userId, list);
  }
  return out;
}

const hitColumns = {
  userId: sp.userId,
  name: users.name,
  image: users.image,
  handle: sp.handle,
  headline: sp.headline,
  location: sp.location,
  graduationYear: sp.graduationYear,
  branch: sp.branch,
  collegeId: sp.collegeId,
  collegeName: colleges.shortName,
  proofScore: sp.proofScore,
  openToWork: sp.openToWork,
  liveDeployments: liveDeploymentsSql,
  ownCommits: ownCommitsSql,
  passedChecks: passedChecksSql,
  endorsements: endorsementsSql,
};

/**
 * Run a search. Callers must have already asserted the recruiter role; this function itself
 * enforces candidate privacy, never company scope (search reads no company data).
 */
export async function searchCandidates(input: unknown, limit = 48): Promise<SearchResult> {
  const filters = normalizeFilters(input);
  const db = await getDb();
  const skillIds = await skillIdsFor(filters.skills);
  const where = buildWhere(filters, skillIds);
  const sort: SearchSort = filters.sort ?? (filters.q ? "relevance" : filters.skills?.length ? "skill" : "score");

  const [rows, [total]] = await Promise.all([
    db
      .select(hitColumns)
      .from(sp)
      .innerJoin(users, eq(users.id, sp.userId))
      .leftJoin(colleges, eq(colleges.id, sp.collegeId))
      .where(where)
      .orderBy(...orderFor(sort, filters, skillIds))
      .limit(limit),
    db.select({ n: count() }).from(sp).where(where),
  ]);

  const skillMap = await skillsFor(rows.map((r) => r.userId));
  const wanted = new Set(filters.skills ?? []);
  const hits: CandidateHit[] = rows.map((r) => {
    const list = skillMap.get(r.userId) ?? [];
    const matched = list.filter((s) => wanted.has(s.slug));
    return {
      ...r,
      liveDeployments: Number(r.liveDeployments),
      ownCommits: Number(r.ownCommits),
      passedChecks: Number(r.passedChecks),
      endorsements: Number(r.endorsements),
      skills: list,
      skillMatch: matched.length ? Math.round(matched.reduce((a, s) => a + s.score, 0) / matched.length) : 0,
    };
  });
  return { total: total?.n ?? 0, hits, filters };
}

/** Facts for specific students, still privacy-filtered (used by compare and shortlists). */
export async function candidatesByIds(userIds: string[]): Promise<CandidateHit[]> {
  if (!userIds.length) return [];
  const db = await getDb();
  const rows = await db
    .select(hitColumns)
    .from(sp)
    .innerJoin(users, eq(users.id, sp.userId))
    .leftJoin(colleges, eq(colleges.id, sp.collegeId))
    .where(and(inArray(sp.userId, userIds), inArray(sp.visibility, [...RECRUITER_VISIBLE])));
  const skillMap = await skillsFor(rows.map((r) => r.userId), 12);
  const byId = new Map(
    rows.map((r) => [
      r.userId,
      {
        ...r,
        liveDeployments: Number(r.liveDeployments),
        ownCommits: Number(r.ownCommits),
        passedChecks: Number(r.passedChecks),
        endorsements: Number(r.endorsements),
        skills: skillMap.get(r.userId) ?? [],
        skillMatch: 0,
      } satisfies CandidateHit,
    ]),
  );
  return userIds.map((id) => byId.get(id)).filter((h): h is CandidateHit => !!h);
}

/** Options for the filter rail. */
export async function getSearchFacets() {
  const db = await getDb();
  const [skillRows, collegeRows, yearRows] = await Promise.all([
    db
      .select({ slug: skills.slug, name: skills.name, n: count(profileSkills.id) })
      .from(skills)
      .leftJoin(profileSkills, and(eq(profileSkills.skillId, skills.id), gte(profileSkills.proofScore, 1)))
      .groupBy(skills.id)
      .orderBy(desc(count(profileSkills.id)), skills.name),
    db
      .select({ id: colleges.id, name: colleges.name, shortName: colleges.shortName, city: colleges.city })
      .from(colleges)
      .orderBy(colleges.shortName),
    db
      .selectDistinct({ year: sp.graduationYear })
      .from(sp)
      .where(and(isNotNull(sp.graduationYear), inArray(sp.visibility, [...RECRUITER_VISIBLE])))
      .orderBy(sp.graduationYear),
  ]);
  return {
    skills: skillRows.map((s) => ({ slug: s.slug, name: s.name, count: Number(s.n) })),
    colleges: collegeRows,
    years: yearRows.map((y) => y.year).filter((y): y is number => y != null),
  };
}
export type SearchFacets = Awaited<ReturnType<typeof getSearchFacets>>;

/* -------------------------------------------------------------------------- */
/* Live match preview for the job editor                                       */
/* -------------------------------------------------------------------------- */

export type JobRequirements = { skills: { slug: string; minScore: number }[]; minScore: number };
export type JobMatchPreview = { total: number; sample: { userId: string; name: string; image: string | null; handle: string }[] };

/**
 * How many recruiter-visible candidates meet a job's bar right now: the same WHERE as evidence
 * search (privacy included), tightened so each required skill clears its own minimum score.
 */
export async function previewJobMatches(req: JobRequirements, sampleSize = 3): Promise<JobMatchPreview> {
  const db = await getDb();
  const slugs = [...new Set(req.skills.map((s) => s.slug.toLowerCase()))].slice(0, 8);
  const skillRows = slugs.length
    ? await db.select({ id: skills.id, slug: skills.slug }).from(skills).where(inArray(skills.slug, slugs))
    : [];
  const idBySlug = new Map(skillRows.map((r) => [r.slug, r.id]));
  const filters = normalizeFilters({ skills: slugs.length ? slugs : undefined, minScore: req.minScore || undefined });
  const conds: SQL[] = [buildWhere(filters, skillRows.map((r) => r.id))];
  for (const s of req.skills) {
    const skillId = idBySlug.get(s.slug.toLowerCase());
    if (skillId && s.minScore > 0) {
      conds.push(
        sql`exists (select 1 from "profile_skills" ps where ps.user_id = ${sp.userId} and ps.skill_id = ${skillId} and ps.proof_score >= ${s.minScore})`,
      );
    }
  }
  const where = and(...conds)!;
  const [sample, [total]] = await Promise.all([
    db
      .select({ userId: sp.userId, name: users.name, image: users.image, handle: sp.handle })
      .from(sp)
      .innerJoin(users, eq(users.id, sp.userId))
      .where(where)
      .orderBy(desc(sp.proofScore))
      .limit(sampleSize),
    db.select({ n: count() }).from(sp).where(where),
  ]);
  return { total: Number(total?.n ?? 0), sample };
}
