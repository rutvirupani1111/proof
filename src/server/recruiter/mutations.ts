/**
 * Recruiter writes. Each takes the session-derived `RecruiterScope` and re-checks ownership of
 * every row it touches, so a card / list / job id from another company is simply "not found".
 * The `"use server"` wrappers in ./actions.ts add the role check and Zod parsing.
 */
import "server-only";
import { and, eq, inArray, max, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  checkAttempts,
  companies,
  jobs,
  notes,
  notifications,
  pipelineCards,
  savedSearches,
  shortlistEntries,
  shortlists,
  skillChecks,
} from "@/db/schema";
import { PIPELINE_STAGE_LABEL, type JobInput, type PipelineStageId, type SearchFiltersInput } from "@/lib/validation/recruiter";
import { canSeeCandidate } from "./queries";
import { ScopeError, type RecruiterScope } from "./scope";

async function companyName(companyId: string): Promise<string> {
  const db = await getDb();
  const c = await db.query.companies.findFirst({ where: eq(companies.id, companyId), columns: { name: true } });
  return c?.name ?? "A company";
}

async function assertJobInScope(scope: RecruiterScope, jobId: string | undefined | null) {
  if (!jobId) return;
  const db = await getDb();
  const job = await db.query.jobs.findFirst({
    where: and(eq(jobs.id, jobId), eq(jobs.companyId, scope.companyId)),
    columns: { id: true },
  });
  if (!job) throw new ScopeError("That job is not in your workspace.");
}

async function assertCandidate(scope: RecruiterScope, studentUserId: string) {
  if (!(await canSeeCandidate(scope, studentUserId))) throw new ScopeError("Candidate not found.");
}

/* ---------------------------------------------------------------- pipeline */

/**
 * Stages a student hears about when a recruiter moves their card. "Sourced" is the recruiter's
 * private long list and "Rejected" is an internal triage column, so neither notifies.
 */
const NOTIFY_STAGES: ReadonlySet<PipelineStageId> = new Set(["contacted", "skill_check", "interview", "offer", "hired"]);

/** Move a card. Fails for any card outside the recruiter's company. */
export async function moveCard(
  scope: RecruiterScope,
  input: { cardId: string; stage: PipelineStageId; position: number },
) {
  const db = await getDb();
  const inScope = and(eq(pipelineCards.id, input.cardId), eq(pipelineCards.companyId, scope.companyId));
  const before = await db.query.pipelineCards.findFirst({
    where: inScope,
    columns: { stage: true, studentUserId: true, jobId: true },
  });
  if (!before) throw new ScopeError("Card not found in your pipeline.");
  const [updated] = await db
    .update(pipelineCards)
    .set({ stage: input.stage, position: input.position })
    .where(inScope)
    .returning({ id: pipelineCards.id, stage: pipelineCards.stage, position: pipelineCards.position });
  if (!updated) throw new ScopeError("Card not found in your pipeline.");
  if (before.stage !== input.stage && NOTIFY_STAGES.has(input.stage)) {
    const [company, job] = await Promise.all([
      companyName(scope.companyId),
      before.jobId
        ? db.query.jobs.findFirst({ where: eq(jobs.id, before.jobId), columns: { title: true } })
        : Promise.resolve(undefined),
    ]);
    await db.insert(notifications).values({
      userId: before.studentUserId,
      type: "application.stage",
      title: `${company} moved you to ${PIPELINE_STAGE_LABEL[input.stage]}`,
      body: job ? `For ${job.title}.` : "Your candidacy moved forward.",
      href: "/student/applications",
    });
  }
  return updated;
}

/** Add a candidate to the board (idempotent per company + job + student). */
export async function addToPipeline(
  scope: RecruiterScope,
  input: { studentUserId: string; jobId?: string; stage: PipelineStageId },
) {
  await assertCandidate(scope, input.studentUserId);
  await assertJobInScope(scope, input.jobId);
  const db = await getDb();
  const existing = await db.query.pipelineCards.findFirst({
    where: and(
      eq(pipelineCards.companyId, scope.companyId),
      eq(pipelineCards.studentUserId, input.studentUserId),
      input.jobId ? eq(pipelineCards.jobId, input.jobId) : sql`${pipelineCards.jobId} is null`,
    ),
  });
  if (existing) return { id: existing.id, created: false };
  const [top] = await db
    .select({ p: max(pipelineCards.position) })
    .from(pipelineCards)
    .where(and(eq(pipelineCards.companyId, scope.companyId), eq(pipelineCards.stage, input.stage)));
  const [card] = await db
    .insert(pipelineCards)
    .values({
      companyId: scope.companyId,
      studentUserId: input.studentUserId,
      jobId: input.jobId ?? null,
      ownerUserId: scope.userId,
      stage: input.stage,
      position: (top?.p ?? 0) + 1024,
    })
    .returning({ id: pipelineCards.id });
  return { id: card!.id, created: true };
}

export async function removeFromPipeline(scope: RecruiterScope, cardId: string) {
  const db = await getDb();
  const deleted = await db
    .delete(pipelineCards)
    .where(and(eq(pipelineCards.id, cardId), eq(pipelineCards.companyId, scope.companyId)))
    .returning({ id: pipelineCards.id });
  if (!deleted.length) throw new ScopeError("Card not found in your pipeline.");
}

/* ---------------------------------------------------------------- shortlists */

export async function createShortlist(
  scope: RecruiterScope,
  input: { name: string; description?: string; jobId?: string },
) {
  await assertJobInScope(scope, input.jobId);
  const db = await getDb();
  const [row] = await db
    .insert(shortlists)
    .values({
      companyId: scope.companyId,
      ownerUserId: scope.userId,
      name: input.name,
      description: input.description || null,
      jobId: input.jobId ?? null,
    })
    .returning({ id: shortlists.id, name: shortlists.name });
  return row!;
}

async function assertShortlist(scope: RecruiterScope, shortlistId: string) {
  const db = await getDb();
  const list = await db.query.shortlists.findFirst({
    where: and(eq(shortlists.id, shortlistId), eq(shortlists.companyId, scope.companyId)),
    columns: { id: true },
  });
  if (!list) throw new ScopeError("Shortlist not found.");
}

export async function addToShortlist(scope: RecruiterScope, input: { shortlistId: string; studentUserId: string }) {
  await assertShortlist(scope, input.shortlistId);
  await assertCandidate(scope, input.studentUserId);
  const db = await getDb();
  await db
    .insert(shortlistEntries)
    .values({ shortlistId: input.shortlistId, studentUserId: input.studentUserId, addedByUserId: scope.userId })
    .onConflictDoNothing();
}

export async function removeFromShortlist(scope: RecruiterScope, input: { shortlistId: string; studentUserId: string }) {
  await assertShortlist(scope, input.shortlistId);
  const db = await getDb();
  await db
    .delete(shortlistEntries)
    .where(and(eq(shortlistEntries.shortlistId, input.shortlistId), eq(shortlistEntries.studentUserId, input.studentUserId)));
}

export async function deleteShortlist(scope: RecruiterScope, shortlistId: string) {
  const db = await getDb();
  const gone = await db
    .delete(shortlists)
    .where(and(eq(shortlists.id, shortlistId), eq(shortlists.companyId, scope.companyId)))
    .returning({ id: shortlists.id });
  if (!gone.length) throw new ScopeError("Shortlist not found.");
}

/* ---------------------------------------------------------------- saved searches */

export async function saveSearch(scope: RecruiterScope, input: { name: string; filters: SearchFiltersInput }) {
  const db = await getDb();
  const [row] = await db
    .insert(savedSearches)
    .values({ companyId: scope.companyId, ownerUserId: scope.userId, name: input.name, filters: input.filters })
    .returning({ id: savedSearches.id, name: savedSearches.name, filters: savedSearches.filters, createdAt: savedSearches.createdAt });
  return row!;
}

export async function deleteSavedSearch(scope: RecruiterScope, id: string) {
  const db = await getDb();
  const gone = await db
    .delete(savedSearches)
    .where(and(eq(savedSearches.id, id), eq(savedSearches.companyId, scope.companyId)))
    .returning({ id: savedSearches.id });
  if (!gone.length) throw new ScopeError("Saved search not found.");
}

/* ---------------------------------------------------------------- jobs */

export async function upsertJob(scope: RecruiterScope, input: JobInput) {
  const db = await getDb();
  const values = {
    title: input.title,
    description: input.description,
    location: input.location,
    workMode: input.workMode,
    employmentType: input.employmentType,
    salaryMin: input.salaryMin ?? null,
    salaryMax: input.salaryMax ?? null,
    minProofScore: input.minProofScore,
    openings: input.openings,
    requiredSkills: input.requiredSkills,
    status: input.status,
  };
  if (input.id) {
    // Editing never changes open/closed; that is setJobStatus's job.
    const { status: _status, ...edit } = values;
    void _status;
    const [row] = await db
      .update(jobs)
      .set(edit)
      .where(and(eq(jobs.id, input.id), eq(jobs.companyId, scope.companyId)))
      .returning({ id: jobs.id });
    if (!row) throw new ScopeError("Job not found.");
    return row;
  }
  const [row] = await db
    .insert(jobs)
    .values({ ...values, companyId: scope.companyId, postedByUserId: scope.userId })
    .returning({ id: jobs.id });
  return row!;
}

export async function setJobStatus(scope: RecruiterScope, jobId: string, status: "open" | "closed") {
  const db = await getDb();
  const [row] = await db
    .update(jobs)
    .set({ status })
    .where(and(eq(jobs.id, jobId), eq(jobs.companyId, scope.companyId)))
    .returning({ id: jobs.id, status: jobs.status });
  if (!row) throw new ScopeError("Job not found.");
  return row;
}

/* ---------------------------------------------------------------- skill-check invite */

export async function inviteToCheck(scope: RecruiterScope, input: { studentUserId: string; skillCheckId: string }) {
  await assertCandidate(scope, input.studentUserId);
  const db = await getDb();
  const check = await db.query.skillChecks.findFirst({
    where: and(eq(skillChecks.id, input.skillCheckId), eq(skillChecks.isPublished, true)),
    columns: { id: true, title: true, slug: true },
  });
  if (!check) throw new ScopeError("Skill check not found.");
  const open = await db.query.checkAttempts.findFirst({
    where: and(
      eq(checkAttempts.userId, input.studentUserId),
      eq(checkAttempts.skillCheckId, check.id),
      inArray(checkAttempts.status, ["invited", "in_progress"]),
    ),
    columns: { id: true },
  });
  if (open) return { id: open.id, created: false };
  const [attempt] = await db
    .insert(checkAttempts)
    .values({ userId: input.studentUserId, skillCheckId: check.id, invitedByUserId: scope.userId, status: "invited" })
    .returning({ id: checkAttempts.id });
  const company = await companyName(scope.companyId);
  await db.insert(notifications).values({
    userId: input.studentUserId,
    type: "check.invited",
    title: `${company} invited you to a skill check`,
    body: `“${check.title}”. Pass it to add verified evidence to your profile.`,
    href: "/student/checks",
  });
  // Move any card for this candidate to the Skill check column, keeping the board truthful.
  await db
    .update(pipelineCards)
    .set({ stage: "skill_check" })
    .where(
      and(
        eq(pipelineCards.companyId, scope.companyId),
        eq(pipelineCards.studentUserId, input.studentUserId),
        inArray(pipelineCards.stage, ["sourced", "contacted"]),
      ),
    );
  return { id: attempt!.id, created: true };
}

/* ---------------------------------------------------------------- notes */

export async function addNote(scope: RecruiterScope, input: { studentUserId: string; body: string }) {
  await assertCandidate(scope, input.studentUserId);
  const db = await getDb();
  const [row] = await db
    .insert(notes)
    .values({ companyId: scope.companyId, authorUserId: scope.userId, studentUserId: input.studentUserId, body: input.body })
    .returning({ id: notes.id, body: notes.body, createdAt: notes.createdAt });
  return row!;
}

export async function deleteNote(scope: RecruiterScope, noteId: string) {
  const db = await getDb();
  const gone = await db
    .delete(notes)
    .where(and(eq(notes.id, noteId), eq(notes.companyId, scope.companyId)))
    .returning({ id: notes.id });
  if (!gone.length) throw new ScopeError("Note not found.");
}
