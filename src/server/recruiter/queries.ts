import "server-only";
import { and, asc, count, desc, eq, gte, inArray, or } from "drizzle-orm";
import { getDb } from "@/db";
import {
  applications,
  attestations,
  checkAttempts,
  colleges,
  companies,
  credentials,
  deployments,
  evidence,
  jobs,
  mentors,
  notes,
  pipelineCards,
  repoStats,
  repos,
  savedSearches,
  shortlistEntries,
  shortlists,
  skillChecks,
  skills,
  studentProfiles,
  users,
} from "@/db/schema";
import { RECRUITER_VISIBLE, candidatesByIds, skillsFor } from "@/server/search/engine";
import type { RecruiterScope } from "./scope";

/** Dashboard summary scoped to the recruiter's company. */
export async function getRecruiterDashboard(companyId: string | null | undefined) {
  const db = await getDb();
  const visible = inArray(studentProfiles.visibility, [...RECRUITER_VISIBLE]);
  const [[searchable], [ready]] = await Promise.all([
    db.select({ n: count() }).from(studentProfiles).where(visible),
    db.select({ n: count() }).from(studentProfiles).where(and(visible, gte(studentProfiles.proofScore, 70))),
  ]);
  if (!companyId) {
    return { company: null, openJobs: 0, pipeline: 0, shortlists: 0, searchable: searchable?.n ?? 0, ready: ready?.n ?? 0 };
  }
  const [company, [open], [pipe], [lists]] = await Promise.all([
    db.query.companies.findFirst({ where: eq(companies.id, companyId) }),
    db.select({ n: count() }).from(jobs).where(and(eq(jobs.companyId, companyId), eq(jobs.status, "open"))),
    db.select({ n: count() }).from(pipelineCards).where(eq(pipelineCards.companyId, companyId)),
    db.select({ n: count() }).from(shortlists).where(eq(shortlists.companyId, companyId)),
  ]);
  return {
    company: company ?? null,
    openJobs: open?.n ?? 0,
    pipeline: pipe?.n ?? 0,
    shortlists: lists?.n ?? 0,
    searchable: searchable?.n ?? 0,
    ready: ready?.n ?? 0,
  };
}

/**
 * May this company see this student? Searchable profiles (public / recruiters) always; a hidden
 * profile only when the student applied to one of the company's jobs (they chose to share).
 */
export async function canSeeCandidate(scope: RecruiterScope | null, studentUserId: string): Promise<boolean> {
  const db = await getDb();
  const profile = await db.query.studentProfiles.findFirst({
    where: eq(studentProfiles.userId, studentUserId),
    columns: { visibility: true },
  });
  if (!profile) return false;
  if ((RECRUITER_VISIBLE as readonly string[]).includes(profile.visibility)) return true;
  if (!scope) return false;
  const [applied] = await db
    .select({ n: count() })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(and(eq(applications.studentUserId, studentUserId), eq(jobs.companyId, scope.companyId)));
  return (applied?.n ?? 0) > 0;
}

/** Evidence-first dossier for one candidate, plus this company's private context. */
export async function getCandidate(scope: RecruiterScope | null, studentUserId: string) {
  if (!(await canSeeCandidate(scope, studentUserId))) return null;
  const db = await getDb();
  const [user, profile] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, studentUserId), columns: { id: true, name: true, image: true } }),
    db.query.studentProfiles.findFirst({ where: eq(studentProfiles.userId, studentUserId) }),
  ]);
  if (!user || !profile) return null;

  const [college, skillMap, evidenceRows, repoRows, deployRows, attemptRows, attestRows, github] = await Promise.all([
    profile.collegeId ? db.query.colleges.findFirst({ where: eq(colleges.id, profile.collegeId) }) : Promise.resolve(undefined),
    skillsFor([studentUserId], 20),
    db
      .select({
        id: evidence.id,
        kind: evidence.kind,
        title: evidence.title,
        summary: evidence.summary,
        skillSlugs: evidence.skillSlugs,
        verifiedAt: evidence.verifiedAt,
        credentialId: credentials.id,
      })
      .from(evidence)
      .leftJoin(credentials, eq(credentials.evidenceId, evidence.id))
      .where(and(eq(evidence.userId, studentUserId), eq(evidence.status, "verified")))
      .orderBy(desc(evidence.verifiedAt)),
    db
      .select({
        id: repos.id,
        fullName: repos.fullName,
        name: repos.name,
        url: repos.url,
        description: repos.description,
        language: repos.primaryLanguage,
        stars: repos.stars,
        status: repos.status,
        ownCommits: repoStats.ownCommits,
        totalCommits: repoStats.totalCommits,
        share: repoStats.authorshipShare,
        activeWeeks: repoStats.activeWeeks,
        firstCommitAt: repoStats.firstCommitAt,
        lastCommitAt: repoStats.lastCommitAt,
        redFlags: repoStats.redFlags,
      })
      .from(repos)
      .leftJoin(repoStats, eq(repoStats.repoId, repos.id))
      .where(and(eq(repos.userId, studentUserId), eq(repos.selected, true)))
      .orderBy(desc(repoStats.ownCommits)),
    db.query.deployments.findMany({ where: eq(deployments.userId, studentUserId), orderBy: desc(deployments.verifiedAt) }),
    db
      .select({
        id: checkAttempts.id,
        title: skillChecks.title,
        level: skillChecks.level,
        status: checkAttempts.status,
        score: checkAttempts.score,
        passedTests: checkAttempts.passedTests,
        totalTests: checkAttempts.totalTests,
        timeTakenSec: checkAttempts.timeTakenSec,
        pasteEvents: checkAttempts.pasteEvents,
        tabBlurs: checkAttempts.tabBlurs,
        submittedAt: checkAttempts.submittedAt,
      })
      .from(checkAttempts)
      .innerJoin(skillChecks, eq(skillChecks.id, checkAttempts.skillCheckId))
      .where(eq(checkAttempts.userId, studentUserId))
      .orderBy(desc(checkAttempts.createdAt)),
    db
      .select({
        id: attestations.id,
        statement: attestations.statement,
        relationship: attestations.relationship,
        respondedAt: attestations.respondedAt,
        mentorName: users.name,
        mentorTitle: mentors.title,
        organization: mentors.organization,
        domain: mentors.emailDomain,
        domainVerifiedAt: mentors.domainVerifiedAt,
        skillName: skills.name,
      })
      .from(attestations)
      .innerJoin(mentors, eq(mentors.id, attestations.mentorId))
      .innerJoin(users, eq(users.id, mentors.userId))
      .leftJoin(skills, eq(skills.id, attestations.skillId))
      .where(and(eq(attestations.studentUserId, studentUserId), eq(attestations.status, "endorsed"))),
    db.query.githubAccounts.findFirst({ where: (g, { eq: e }) => e(g.userId, studentUserId) }),
  ]);

  const context = scope ? await getCandidateContext(scope, studentUserId) : null;

  return {
    user,
    profile,
    college: college ?? null,
    skills: skillMap.get(studentUserId) ?? [],
    evidence: evidenceRows,
    repos: repoRows,
    deployments: deployRows.map((d) => ({
      id: d.id,
      url: d.url,
      status: d.status,
      method: d.method,
      homepageMatchesRepo: d.homepageMatchesRepo,
      lastStatusCode: d.lastStatusCode,
      lastResponseMs: d.lastResponseMs,
      lastCheckedAt: d.lastCheckedAt,
      verifiedAt: d.verifiedAt,
    })),
    attempts: attemptRows,
    attestations: attestRows,
    github: github ? { username: github.username, status: github.status, verifiedAt: github.verifiedAt } : null,
    context,
  };
}
export type CandidateDossier = NonNullable<Awaited<ReturnType<typeof getCandidate>>>;

/** This company's private context on a candidate: pipeline, shortlists, notes, applications. */
export async function getCandidateContext(scope: RecruiterScope, studentUserId: string) {
  const db = await getDb();
  const [cards, lists, noteRows, apps] = await Promise.all([
    db
      .select({ id: pipelineCards.id, stage: pipelineCards.stage, jobTitle: jobs.title })
      .from(pipelineCards)
      .leftJoin(jobs, eq(jobs.id, pipelineCards.jobId))
      .where(and(eq(pipelineCards.companyId, scope.companyId), eq(pipelineCards.studentUserId, studentUserId))),
    db
      .select({ id: shortlists.id, name: shortlists.name })
      .from(shortlistEntries)
      .innerJoin(shortlists, eq(shortlists.id, shortlistEntries.shortlistId))
      .where(and(eq(shortlists.companyId, scope.companyId), eq(shortlistEntries.studentUserId, studentUserId))),
    db
      .select({ id: notes.id, body: notes.body, createdAt: notes.createdAt, authorName: users.name })
      .from(notes)
      .innerJoin(users, eq(users.id, notes.authorUserId))
      .where(and(eq(notes.companyId, scope.companyId), eq(notes.studentUserId, studentUserId)))
      .orderBy(desc(notes.createdAt)),
    db
      .select({ id: applications.id, stage: applications.stage, jobTitle: jobs.title, appliedAt: applications.appliedAt })
      .from(applications)
      .innerJoin(jobs, eq(jobs.id, applications.jobId))
      .where(and(eq(jobs.companyId, scope.companyId), eq(applications.studentUserId, studentUserId))),
  ]);
  return { cards, shortlists: lists, notes: noteRows, applications: apps };
}

/** Up to three candidates for side-by-side compare (privacy-filtered). */
export async function getCompare(ids: string[]) {
  const unique = [...new Set(ids)].slice(0, 3);
  return candidatesByIds(unique);
}

export async function getShortlists(scope: RecruiterScope) {
  const db = await getDb();
  const lists = await db
    .select({
      id: shortlists.id,
      name: shortlists.name,
      description: shortlists.description,
      createdAt: shortlists.createdAt,
      jobTitle: jobs.title,
      ownerName: users.name,
    })
    .from(shortlists)
    .leftJoin(jobs, eq(jobs.id, shortlists.jobId))
    .innerJoin(users, eq(users.id, shortlists.ownerUserId))
    .where(eq(shortlists.companyId, scope.companyId))
    .orderBy(desc(shortlists.createdAt));
  if (!lists.length) return [];
  const entries = await db
    .select({ shortlistId: shortlistEntries.shortlistId, studentUserId: shortlistEntries.studentUserId, addedAt: shortlistEntries.createdAt })
    .from(shortlistEntries)
    .where(inArray(shortlistEntries.shortlistId, lists.map((l) => l.id)))
    .orderBy(asc(shortlistEntries.createdAt));
  const people = await candidatesByIds([...new Set(entries.map((e) => e.studentUserId))]);
  const byId = new Map(people.map((p) => [p.userId, p]));
  return lists.map((l) => ({
    ...l,
    candidates: entries
      .filter((e) => e.shortlistId === l.id)
      .map((e) => byId.get(e.studentUserId))
      .filter((c): c is NonNullable<typeof c> => !!c),
  }));
}

export async function getShortlistOptions(scope: RecruiterScope) {
  const db = await getDb();
  return db
    .select({ id: shortlists.id, name: shortlists.name })
    .from(shortlists)
    .where(eq(shortlists.companyId, scope.companyId))
    .orderBy(desc(shortlists.createdAt));
}

export async function getSavedSearches(scope: RecruiterScope) {
  const db = await getDb();
  return db
    .select({ id: savedSearches.id, name: savedSearches.name, filters: savedSearches.filters, createdAt: savedSearches.createdAt })
    .from(savedSearches)
    .where(eq(savedSearches.companyId, scope.companyId))
    .orderBy(desc(savedSearches.createdAt));
}

export async function getJobs(scope: RecruiterScope) {
  const db = await getDb();
  const rows = await db
    .select({
      job: jobs,
      applicants: count(applications.id),
    })
    .from(jobs)
    .leftJoin(applications, eq(applications.jobId, jobs.id))
    .where(eq(jobs.companyId, scope.companyId))
    .groupBy(jobs.id)
    .orderBy(desc(jobs.createdAt));
  return rows.map((r) => ({ ...r.job, applicants: Number(r.applicants) }));
}
export type RecruiterJob = Awaited<ReturnType<typeof getJobs>>[number];

export async function getJobOptions(scope: RecruiterScope) {
  const db = await getDb();
  return db
    .select({ id: jobs.id, title: jobs.title, status: jobs.status })
    .from(jobs)
    .where(eq(jobs.companyId, scope.companyId))
    .orderBy(desc(jobs.createdAt));
}

/** The kanban: only this company's cards, ever. */
export async function getPipelineBoard(scope: RecruiterScope, jobId?: string | null) {
  const db = await getDb();
  const where = jobId
    ? and(eq(pipelineCards.companyId, scope.companyId), eq(pipelineCards.jobId, jobId))
    : eq(pipelineCards.companyId, scope.companyId);
  const rows = await db
    .select({
      id: pipelineCards.id,
      stage: pipelineCards.stage,
      position: pipelineCards.position,
      jobId: pipelineCards.jobId,
      jobTitle: jobs.title,
      studentUserId: pipelineCards.studentUserId,
      name: users.name,
      image: users.image,
      handle: studentProfiles.handle,
      headline: studentProfiles.headline,
      proofScore: studentProfiles.proofScore,
      updatedAt: pipelineCards.updatedAt,
    })
    .from(pipelineCards)
    .innerJoin(users, eq(users.id, pipelineCards.studentUserId))
    .leftJoin(studentProfiles, eq(studentProfiles.userId, pipelineCards.studentUserId))
    .leftJoin(jobs, eq(jobs.id, pipelineCards.jobId))
    .where(where)
    .orderBy(asc(pipelineCards.position));
  const skillMap = await skillsFor([...new Set(rows.map((r) => r.studentUserId))], 3);
  return rows.map((r) => ({
    ...r,
    proofScore: r.proofScore ?? 0,
    updatedAt: r.updatedAt.toISOString(),
    skills: (skillMap.get(r.studentUserId) ?? []).map((s) => s.name),
  }));
}
export type BoardCard = Awaited<ReturnType<typeof getPipelineBoard>>[number];

export async function getPublishedChecks() {
  const db = await getDb();
  return db
    .select({ id: skillChecks.id, title: skillChecks.title, level: skillChecks.level, skillName: skills.name })
    .from(skillChecks)
    .leftJoin(skills, eq(skills.id, skillChecks.skillId))
    .where(eq(skillChecks.isPublished, true))
    .orderBy(asc(skillChecks.title));
}

/** Company workspace: profile, domain state, teammates, pending invites (stub: notifications). */
export async function getCompanyWorkspace(scope: RecruiterScope) {
  const db = await getDb();
  const [company, teammates] = await Promise.all([
    db.query.companies.findFirst({ where: eq(companies.id, scope.companyId) }),
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        domainVerification: users.domainVerification,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(and(eq(users.companyId, scope.companyId), or(eq(users.role, "recruiter"), eq(users.role, "admin"))))
      .orderBy(asc(users.createdAt)),
  ]);
  return { company: company ?? null, teammates };
}

/** Students who have not hidden their profile, for messaging pickers. */
export async function isMessageableStudent(studentUserId: string) {
  const db = await getDb();
  const row = await db.query.studentProfiles.findFirst({
    where: and(eq(studentProfiles.userId, studentUserId), inArray(studentProfiles.visibility, [...RECRUITER_VISIBLE])),
    columns: { id: true },
  });
  return !!row;
}
