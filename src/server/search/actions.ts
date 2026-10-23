"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/validation/recruiter";
import { AuthError, assertRole } from "@/server/auth/guard";
import { previewJobMatches, searchCandidates, type JobMatchPreview, type SearchResult } from "./engine";

/** Live evidence search for the recruiter search page. Input is untrusted and re-parsed. */
export async function searchCandidatesAction(filters: unknown): Promise<ActionResult<SearchResult>> {
  try {
    await assertRole("recruiter");
    return { ok: true, data: await searchCandidates(filters) };
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.message };
    throw err;
  }
}

const jobRequirementsSchema = z.object({
  skills: z.array(z.object({ slug: z.string().trim().min(1).max(40), minScore: z.coerce.number().int().min(0).max(100) })).max(8),
  minScore: z.coerce.number().int().min(0).max(100),
});

/** Live "N verified candidates match" counter for the job editor. */
export async function previewJobMatchesAction(input: unknown): Promise<ActionResult<JobMatchPreview>> {
  try {
    await assertRole("recruiter");
    const parsed = jobRequirementsSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Those requirements could not be read." };
    return { ok: true, data: await previewJobMatches(parsed.data) };
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.message };
    throw err;
  }
}
