/**
 * THE guard. Every protected server component, page, server action and route handler calls one
 * of these. The proxy (src/proxy.ts) only does an optimistic cookie check; this is the real one.
 *
 *   const user = await requireRole("recruiter");           // page / layout: redirects
 *   const user = await requireRole(["college", "mentor"]); // several roles
 *   const user = await assertRole("student");              // server action / route: throws
 */
import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { homeFor, isRole, type Role } from "@/lib/auth/roles";
import { getAuth, type SessionUser } from "./auth";

/** Current session (deduplicated per request). `null` when signed out. */
export const getSession = cache(async () => {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isRole((session.user as { role?: unknown }).role)) return null;
  return { ...session, user: session.user as SessionUser };
});

export async function getCurrentUser(): Promise<SessionUser | null> {
  return (await getSession())?.user ?? null;
}

function allowed(role: Role, roles: Role | Role[]): boolean {
  const list = Array.isArray(roles) ? roles : [roles];
  return role === "admin" || list.includes(role);
}

/** Where an unverified account is sent: the 6-digit sign-up code screen. */
export const VERIFY_EMAIL_PATH = "/verify-email";

/**
 * For pages/layouts: redirects to /login (signed out), /verify-email (email not confirmed yet)
 * or the user's own portal (wrong role).
 */
export async function requireRole(roles: Role | Role[], nextPath?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  if (!user.emailVerified) redirect(VERIFY_EMAIL_PATH);
  if (!allowed(user.role, roles)) redirect(homeFor(user.role));
  return user;
}

export async function requireUser(nextPath?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  if (!user.emailVerified) redirect(VERIFY_EMAIL_PATH);
  return user;
}

export class AuthError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
  }
}

/** For server actions and route handlers: throws AuthError instead of redirecting. */
export async function assertRole(roles: Role | Role[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError(401, "Sign in required.");
  if (!user.emailVerified) throw new AuthError(403, "Verify your email address first.");
  if (!allowed(user.role, roles)) throw new AuthError(403, "Not allowed for your role.");
  return user;
}
