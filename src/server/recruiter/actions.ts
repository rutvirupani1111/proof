"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { emailDomain } from "@/lib/handle";
import { fieldErrors } from "@/lib/validation/auth";
import {
  inviteCheckSchema,
  inviteTeammateSchema,
  jobSchema,
  noteSchema,
  pipelineAddSchema,
  pipelineMoveSchema,
  saveSearchSchema,
  shortlistCreateSchema,
  shortlistEntrySchema,
  type ActionResult,
} from "@/lib/validation/recruiter";
import { AuthError, assertRole } from "@/server/auth/guard";
import { normalizeFilters } from "@/server/search/engine";
import * as m from "./mutations";
import { getCompanyWorkspace } from "./queries";
import { ScopeError, recruiterScopeOf, type RecruiterScope } from "./scope";

/** Role check + session scope + Zod parse + uniform error mapping for every recruiter action. */
async function run<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  fn: (scope: RecruiterScope, data: z.infer<S>) => Promise<T>,
  revalidate: string[] = [],
): Promise<ActionResult<T>> {
  try {
    const user = await assertRole("recruiter");
    const scope = recruiterScopeOf(user);
    if (!scope) return { ok: false, error: "Join a company workspace first." };
    const parsed = schema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
    const data = await fn(scope, parsed.data);
    for (const p of revalidate) revalidatePath(p);
    return { ok: true, data };
  } catch (err) {
    if (err instanceof AuthError || err instanceof ScopeError) return { ok: false, error: err.message };
    throw err;
  }
}

const idSchema = z.string().trim().min(1).max(64);
function runId<T>(input: unknown, fn: (scope: RecruiterScope, id: string) => Promise<T>, revalidate: string[] = []) {
  return run(idSchema, input, fn, revalidate);
}

export async function movePipelineCardAction(input: unknown) {
  return run(pipelineMoveSchema, input, m.moveCard);
}

export async function addToPipelineAction(input: unknown) {
  return run(pipelineAddSchema, input, m.addToPipeline, ["/recruiter/pipeline"]);
}

export async function removeFromPipelineAction(cardId: unknown) {
  return runId(cardId, m.removeFromPipeline, ["/recruiter/pipeline"]);
}

export async function createShortlistAction(input: unknown) {
  return run(shortlistCreateSchema, input, m.createShortlist, ["/recruiter/shortlists"]);
}

export async function addToShortlistAction(input: unknown) {
  return run(shortlistEntrySchema, input, m.addToShortlist, ["/recruiter/shortlists"]);
}

export async function removeFromShortlistAction(input: unknown) {
  return run(shortlistEntrySchema, input, m.removeFromShortlist, ["/recruiter/shortlists"]);
}

export async function deleteShortlistAction(id: unknown) {
  return runId(id, m.deleteShortlist, ["/recruiter/shortlists"]);
}

export async function saveSearchAction(input: unknown) {
  return run(
    saveSearchSchema,
    input,
    async (scope, data) => {
      const saved = await m.saveSearch(scope, { name: data.name, filters: normalizeFilters(data.filters) });
      return { ...saved, createdAt: saved.createdAt.toISOString() };
    },
    ["/recruiter/search"],
  );
}

export async function deleteSavedSearchAction(id: unknown) {
  return runId(id, m.deleteSavedSearch, ["/recruiter/search"]);
}

export async function saveJobAction(input: unknown) {
  return run(jobSchema, input, m.upsertJob, ["/recruiter/jobs", "/recruiter"]);
}

export async function closeJobAction(id: unknown) {
  return runId(id, (s, jobId) => m.setJobStatus(s, jobId, "closed"), ["/recruiter/jobs", "/recruiter"]);
}

export async function reopenJobAction(id: unknown) {
  return runId(id, (s, jobId) => m.setJobStatus(s, jobId, "open"), ["/recruiter/jobs", "/recruiter"]);
}

export async function inviteToCheckAction(input: unknown) {
  return run(inviteCheckSchema, input, m.inviteToCheck, ["/recruiter/pipeline"]);
}

export async function addNoteAction(input: unknown) {
  return run(noteSchema, input, async (scope, data) => {
    const note = await m.addNote(scope, data);
    return { ...note, createdAt: note.createdAt.toISOString() };
  });
}

export async function deleteNoteAction(id: unknown) {
  return runId(id, m.deleteNote);
}

/**
 * Invite a teammate (stub until an email provider is configured): the address must be on the
 * company's domain; the response carries a sign-up link the recruiter can share by hand.
 */
export async function inviteTeammateAction(input: unknown) {
  return run(inviteTeammateSchema, input, async (scope, data) => {
    const { company } = await getCompanyWorkspace(scope);
    if (!company) throw new ScopeError("Company not found.");
    if (emailDomain(data.email) !== company.domain) {
      throw new ScopeError(`Teammates must use an @${company.domain} address.`);
    }
    return { email: data.email, link: `/signup?role=recruiter&email=${encodeURIComponent(data.email)}` };
  });
}
