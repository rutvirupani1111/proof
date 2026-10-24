"use server";

import "server-only";
import { headers } from "next/headers";
import { z } from "zod";
import { homeFor } from "@/lib/auth/roles";
import { DEMO_KEYS, DEMO_MODE, DEMO_PASSWORD, demoAccount } from "@/lib/demo";
import { getAuth } from "@/server/auth/auth";
import { allowDemoSignIn } from "./throttle";

const demoKeySchema = z.enum(DEMO_KEYS);

type Result = { ok: true; home: string } | { ok: false; error: string };

/**
 * One-tap sign-in as a pinned demo account. Only works when NEXT_PUBLIC_DEMO_MODE=true, and only
 * for the fixed accounts in `DEMO_ACCOUNTS`: the client sends a key, never an email or password.
 * Calling `auth.api.signInEmail` server-side skips Better Auth's request rate limiter, which is
 * the intended demo-mode bypass; `allowDemoSignIn` keeps a looser per-IP cap in its place.
 * The `nextCookies()` plugin writes the session cookie on this action's response.
 */
export async function demoSignIn(key: unknown): Promise<Result> {
  if (!DEMO_MODE) return { ok: false, error: "Demo sign-in is turned off on this deployment." };
  const parsed = demoKeySchema.safeParse(key);
  const account = parsed.success ? demoAccount(parsed.data) : undefined;
  if (!account) return { ok: false, error: "Unknown demo account." };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  if (!allowDemoSignIn(ip)) return { ok: false, error: "Too many demo sign-ins. Wait a minute and try again." };

  try {
    const auth = await getAuth();
    const res = await auth.api.signInEmail({ body: { email: account.email, password: DEMO_PASSWORD }, headers: h });
    return { ok: true, home: homeFor((res.user as { role?: string }).role ?? account.role) };
  } catch {
    return { ok: false, error: "That demo account is not available right now." };
  }
}
