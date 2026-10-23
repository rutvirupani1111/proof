/**
 * Institutional email-domain verification by magic link, for any role:
 *
 *   const { link, delivered } = await createDomainMagicLink({ userId, email, purpose: "mentor", baseUrl });
 *   // delivered === false -> no email provider configured: show `link` on screen (dev / showcase)
 *   const proof = await consumeDomainMagicLink(token); // { userId, purpose, email } | null (single use)
 *
 * Tokens live in Better Auth's `verifications` table under identifier `domain:<purpose>:<userId>`;
 * only the sha256 of the secret is stored, with the email it was sent to. 30-minute expiry.
 * Email goes through Resend when RESEND_API_KEY is set (EMAIL_FROM optional).
 *
 * Callers authorise first: pass the session user's id and email, never client values, and check
 * the consumed `userId` against the session before flipping any verification flag.
 */
import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { verifications } from "@/db/schema";
import {
  DOMAIN_LINK_TTL_MS,
  confirmPathFor,
  domainOf,
  identifierFor,
  institutionalEmailProblem,
  mintToken,
  parseToken,
  secretMatches,
  type DomainPurpose,
} from "./domain-rules";

export { institutionalEmailProblem, isFreeMailDomain, type DomainPurpose } from "./domain-rules";

export class DomainVerificationError extends Error {}

export function emailProviderConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

async function sendMagicLinkEmail(to: string, link: string, purpose: DomainPurpose): Promise<void> {
  const what = purpose === "mentor" ? "your mentor domain" : purpose === "company" ? "your company domain" : "your college domain";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "Proof <onboarding@resend.dev>",
      to: [to],
      subject: `Verify ${what} on Proof`,
      text: `Open this link within 30 minutes to verify @${domainOf(to)} on Proof:\n\n${link}\n\nIf you did not ask for this, ignore this email.`,
      html: `<p>Open this link within 30 minutes to verify <strong>@${domainOf(to)}</strong> on Proof:</p><p><a href="${link}">Verify @${domainOf(to)}</a></p><p>If you did not ask for this, ignore this email.</p>`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new DomainVerificationError("The verification email could not be sent. Try again in a minute.");
}

export async function createDomainMagicLink({
  userId,
  email,
  purpose,
  baseUrl,
}: {
  userId: string;
  email: string;
  purpose: DomainPurpose;
  baseUrl: string;
}): Promise<{ link: string; delivered: boolean; expiresAt: Date }> {
  const problem = institutionalEmailProblem(email);
  if (problem) throw new DomainVerificationError(problem);

  const db = await getDb();
  const identifier = identifierFor(purpose, userId);
  const { token, hash } = mintToken(purpose, userId);
  const expiresAt = new Date(Date.now() + DOMAIN_LINK_TTL_MS);
  // One outstanding link per user and purpose.
  await db.delete(verifications).where(eq(verifications.identifier, identifier));
  await db.insert(verifications).values({
    id: crypto.randomUUID(),
    identifier,
    value: JSON.stringify({ hash, email: email.toLowerCase() }),
    expiresAt,
  });

  const link = `${baseUrl.replace(/\/$/, "")}${confirmPathFor(purpose)}?token=${encodeURIComponent(token)}`;
  if (!emailProviderConfigured()) return { link, delivered: false, expiresAt };
  await sendMagicLinkEmail(email, link, purpose);
  return { link, delivered: true, expiresAt };
}

/** Validates and burns a token. Returns null when unknown, expired, already used or tampered. */
export async function consumeDomainMagicLink(
  token: string,
): Promise<{ userId: string; purpose: DomainPurpose; email: string; domain: string } | null> {
  const parsed = parseToken(token);
  if (!parsed) return null;
  const db = await getDb();
  const identifier = identifierFor(parsed.purpose, parsed.userId);
  const rows = await db.select().from(verifications).where(eq(verifications.identifier, identifier));
  for (const row of rows) {
    let stored: { hash?: string; email?: string };
    try {
      stored = JSON.parse(row.value) as { hash?: string; email?: string };
    } catch {
      continue;
    }
    if (!stored.hash || !stored.email || !secretMatches(parsed.secret, stored.hash)) continue;
    await db.delete(verifications).where(eq(verifications.id, row.id));
    if (row.expiresAt.getTime() < Date.now()) return null;
    return { userId: parsed.userId, purpose: parsed.purpose, email: stored.email, domain: domainOf(stored.email) };
  }
  return null;
}

/** Non-consuming peek for the confirm page: is this token well-formed and still outstanding? */
export async function peekDomainMagicLink(token: string): Promise<{ userId: string; purpose: DomainPurpose; domain: string } | null> {
  const parsed = parseToken(token);
  if (!parsed) return null;
  const db = await getDb();
  const rows = await db
    .select()
    .from(verifications)
    .where(eq(verifications.identifier, identifierFor(parsed.purpose, parsed.userId)));
  for (const row of rows) {
    try {
      const stored = JSON.parse(row.value) as { hash?: string; email?: string };
      if (stored.hash && stored.email && secretMatches(parsed.secret, stored.hash) && row.expiresAt.getTime() >= Date.now()) {
        return { userId: parsed.userId, purpose: parsed.purpose, domain: domainOf(stored.email) };
      }
    } catch {
      /* ignore malformed rows */
    }
  }
  return null;
}
