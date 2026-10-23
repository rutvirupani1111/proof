import "server-only";
import type { SessionUser } from "@/server/auth/auth";

/**
 * Everything a recruiter may read or write is keyed by this scope, built from the session only.
 * `companyId` is never accepted from a form or URL.
 */
export type RecruiterScope = { userId: string; companyId: string };

/** `null` when the user has no company (e.g. admin browsing the portal). */
export function recruiterScopeOf(user: SessionUser): RecruiterScope | null {
  const companyId = user.companyId as string | null | undefined;
  return companyId ? { userId: user.id, companyId } : null;
}

export class ScopeError extends Error {
  constructor(message = "Not found in your workspace.") {
    super(message);
  }
}
