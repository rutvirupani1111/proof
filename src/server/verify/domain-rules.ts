/**
 * Pure rules for institutional email-domain verification (no DB, no server-only), so they can be
 * unit-tested and reused by any portal: mentors, recruiters (company) and placement cells (college).
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const DOMAIN_PURPOSES = ["mentor", "company", "college"] as const;
export type DomainPurpose = (typeof DOMAIN_PURPOSES)[number];

/** Magic links expire after 30 minutes and work once. */
export const DOMAIN_LINK_TTL_MS = 30 * 60 * 1000;

/** Consumer mailbox providers: anyone can get an address, so they prove nothing about an institution. */
export const FREE_MAIL_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.in",
  "ymail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "rediffmail.com",
  "aol.com",
  "zoho.com",
  "zohomail.in",
  "yandex.com",
  "yandex.ru",
  "gmx.com",
  "gmx.net",
] as const;

const FREE_ROOTS = ["gmail", "googlemail", "yahoo", "outlook", "hotmail", "live", "icloud", "proton", "protonmail", "rediffmail", "aol", "zoho", "yandex", "gmx"];

export function domainOf(email: string): string {
  return email.split("@")[1]?.trim().toLowerCase() ?? "";
}

/** True for consumer mailbox domains (gmail.com, yahoo.co.in, outlook.in, ...). */
export function isFreeMailDomain(domain: string): boolean {
  const d = domain.trim().toLowerCase();
  if (!d) return true;
  if ((FREE_MAIL_DOMAINS as readonly string[]).includes(d)) return true;
  const root = d.split(".")[0] ?? "";
  return FREE_ROOTS.includes(root);
}

/** Human message when the email cannot prove an institution, or null when it can. */
export function institutionalEmailProblem(email: string): string | null {
  const domain = domainOf(email);
  if (!domain || !domain.includes(".")) return "That does not look like a valid email address.";
  if (isFreeMailDomain(domain)) {
    return `@${domain} is a personal mailbox provider. Use your college or company email so we can verify the institution.`;
  }
  return null;
}

export function identifierFor(purpose: DomainPurpose, userId: string): string {
  return `domain:${purpose}:${userId}`;
}

export function hashToken(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/** Token shape: `<purpose>.<base64url(userId)>.<secret>`; only the sha256 of the secret is stored. */
export function mintToken(purpose: DomainPurpose, userId: string): { token: string; hash: string } {
  const secret = randomBytes(32).toString("base64url");
  const token = `${purpose}.${Buffer.from(userId, "utf8").toString("base64url")}.${secret}`;
  return { token, hash: hashToken(secret) };
}

export function parseToken(token: string): { purpose: DomainPurpose; userId: string; secret: string } | null {
  const parts = token.trim().split(".");
  if (parts.length !== 3) return null;
  const [purpose, uid, secret] = parts as [string, string, string];
  if (!(DOMAIN_PURPOSES as readonly string[]).includes(purpose) || !uid || secret.length < 20) return null;
  const userId = Buffer.from(uid, "base64url").toString("utf8");
  if (!userId) return null;
  return { purpose: purpose as DomainPurpose, userId, secret };
}

/** Constant-time comparison of a presented secret with a stored hash. */
export function secretMatches(secret: string, storedHash: string): boolean {
  const a = Buffer.from(hashToken(secret), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Where each purpose's confirm page lives. */
export function confirmPathFor(purpose: DomainPurpose): string {
  return purpose === "mentor" ? "/mentor/verify" : purpose === "company" ? "/recruiter/verify-domain" : "/college/verify-domain";
}
