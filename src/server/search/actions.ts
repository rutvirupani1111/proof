"use server";

import type { ActionResult } from "@/lib/validation/recruiter";
import { AuthError, assertRole } from "@/server/auth/guard";
import { searchCandidates, type SearchResult } from "./engine";

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
