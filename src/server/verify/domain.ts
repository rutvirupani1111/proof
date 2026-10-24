/**
 * Institutional email-domain verification by magic link, for any role:
 *
 *   const { link, delivered } = await createDomainMagicLink({ userId, email, purpose: "mentor", baseUrl });
 *   // delivered === false -> no email provider configured: show `link` on screen (dev / showcase)
 *   const proof = await consumeDomainMagicLink(token); // { userId, purpose, email } | null (single use)
 *
 * Tokens live in Better Auth's `verifications` table under identifier `domain:<purpose>:<userId>`;
 * only the sha256 of the secret is stored, with the email it was sent to. 30-minute expiry.
 * Email goes through the mail adapter (src/server/email): sent when RESEND_API_KEY and EMAIL_FROM
 * are set, shown on screen only in demo mode / development, a friendly error otherwise.
 *
 * Callers authorise first: pass the session user's id and email, never client values, and check
 * the consumed `userId` against the session before flipping any verification flag.
 */
import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { verifications } from "@/db/schema";
import { domainLinkEmail, sendEmail } from "@/server/email";
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

async function sendMagicLinkEmail(to: string, link: string, purpose: DomainPurpose) {
  const what = purpose === "mentor" ? "your mentor domain" : purpose === "company" ? "your company domain" : "your college domain";
  const minutes = Math.round(DOMAIN_LINK_TTL_MS / 60_000);
  return sendEmail({ to, template: "domain-link", ...domainLinkEmail({ link, domain: domainOf(to), what, minutes }), reveal: { link } });
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
  const res = await sendMagicLinkEmail(email, link, purpose);
  if (res.status === "sent") return { link, delivered: true, expiresAt };
  // Email not configured yet (demo mode / development): the caller shows the link on screen.
  if (res.status === "onscreen") return { link, delivered: false, expiresAt };
  throw new DomainVerificationError(res.message);
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
