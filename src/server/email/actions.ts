"use server";

/**
 * What happened to the last code we tried to email? The verify and reset screens call this right
 * after asking Better Auth for a code. The code itself is only ever returned for an "onscreen"
 * row (demo mode / development fallback), and only to the right person:
 *   - verification: the signed-in user's own address (session, never the client);
 *   - password reset: the typed address, except the shared demo accounts (their reset would lock
 *     every visitor out of the showcase).
 */
import { z } from "zod";
import { demoAccountForEmail } from "@/lib/demo";
import { getCurrentUser } from "@/server/auth/guard";
import { emailConfig } from "./config";
import { FRIENDLY_FAILURE } from "./deliver";
import { latestDelivery } from "./index";

/** `sentAt` (ISO) anchors the expiry countdown on screen. */
export type CodeDelivery =
  | { state: "sent"; email: string; sentAt: string }
  | { state: "onscreen"; email: string; sentAt: string; code: string | null; note: string }
  | { state: "failed"; email: string; message: string }
  | { state: "rate_limited"; email: string; message: string }
  | { state: "none"; email: string };

const NOTE = "Email isn't configured yet, so your code is shown here instead.";

function fromRow(email: string, row: Awaited<ReturnType<typeof latestDelivery>>, reveal: boolean): CodeDelivery {
  if (!row) return { state: "none", email };
  const sentAt = row.createdAt.toISOString();
  if (row.status === "sent") return { state: "sent", email, sentAt };
  if (row.status === "rate_limited") return { state: "rate_limited", email, message: "Too many codes requested. Wait a few minutes and try again." };
  if (row.status === "onscreen" && reveal && emailConfig().fallbackVisible) return { state: "onscreen", email, sentAt, code: row.reveal?.code ?? null, note: NOTE };
  return { state: "failed", email, message: FRIENDLY_FAILURE };
}

export async function verificationCodeStatus(): Promise<CodeDelivery | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return fromRow(user.email, await latestDelivery(user.email, "verify-code"), true);
}

export async function resetCodeStatus(input: unknown): Promise<CodeDelivery | null> {
  const parsed = z.email().safeParse(input);
  if (!parsed.success) return null;
  const email = parsed.data.toLowerCase();
  if (demoAccountForEmail(email)) {
    return { state: "failed", email, message: "Demo accounts share one password (shown on the sign-in page), so they can't be reset." };
  }
  return fromRow(email, await latestDelivery(email, "password-reset"), true);
}
