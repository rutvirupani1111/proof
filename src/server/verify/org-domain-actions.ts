"use server";

/**
 * Company (recruiter) and college (placement officer) domain verification by magic link.
 * Same engine as mentors (`createDomainMagicLink` / `consumeDomainMagicLink`); the link lands on
 * `/recruiter/verify-domain` or `/college/verify-domain`, where the signed-in user confirms.
 * The confirmed address must be at the organisation's own domain (`companies.domain` /
 * `colleges.domain`), so a recruiter cannot verify Kitecode from a personal company address.
 */
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getDb } from "@/db";
import { colleges, companies, notifications, users } from "@/db/schema";
import { orgOf } from "./org-domain";
import { domainTokenSchema } from "@/lib/validation/mentor";
import { AuthError, assertRole } from "@/server/auth/guard";
import { DomainVerificationError, consumeDomainMagicLink, createDomainMagicLink, peekDomainMagicLink } from "./domain";
import { domainOf } from "./domain-rules";

import type { OrgPurpose } from "./org-domain";
type Fail = { ok: false; error: string };

const ROLE = { company: "recruiter", college: "college" } as const;
const HOME = { company: "/recruiter/company", college: "/college/settings" } as const;

async function baseUrl(): Promise<string> {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:5190";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function failFrom(err: unknown): Fail {
  if (err instanceof AuthError || err instanceof DomainVerificationError) return { ok: false, error: err.message };
  console.error(err);
  return { ok: false, error: "Something went wrong. Try again." };
}

export async function requestOrgDomainLink(
  purpose: OrgPurpose,
): Promise<{ ok: true; delivered: boolean; link: string | null; email: string; alreadyVerified: boolean } | Fail> {
  try {
    if (purpose !== "company" && purpose !== "college") return { ok: false, error: "Unknown verification." };
    const user = await assertRole(ROLE[purpose]);
    const org = await orgOf(purpose, user);
    if (!org) return { ok: false, error: purpose === "company" ? "Join a company workspace first." : "Join a college first." };
    if (org.domainVerifiedAt && user.domainVerification === "verified") {
      return { ok: true, delivered: false, link: null, email: user.email, alreadyVerified: true };
    }
    if (domainOf(user.email) !== org.domain) {
      return { ok: false, error: `Sign in with an @${org.domain} address to verify ${org.name}.` };
    }
    const { link, delivered } = await createDomainMagicLink({ userId: user.id, email: user.email, purpose, baseUrl: await baseUrl() });
    // The link is only ever shown on screen when no email provider is configured.
    return { ok: true, delivered, link: delivered ? null : link, email: user.email, alreadyVerified: false };
  } catch (err) {
    return failFrom(err);
  }
}

export async function confirmOrgDomain(purpose: OrgPurpose, input: unknown): Promise<{ ok: true; domain: string; name: string } | Fail> {
  try {
    if (purpose !== "company" && purpose !== "college") return { ok: false, error: "Unknown verification." };
    const user = await assertRole(ROLE[purpose]);
    const parsed = domainTokenSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "This link is malformed. Request a new one." };
    // Peek first so a different signed-in account cannot burn someone else's link.
    const peek = await peekDomainMagicLink(parsed.data.token);
    if (!peek || peek.purpose !== purpose) return { ok: false, error: "This link has expired or was already used. Request a new one." };
    if (peek.userId !== user.id) return { ok: false, error: "This link belongs to a different account. Sign in as the person it was sent to." };
    const org = await orgOf(purpose, user);
    if (!org) return { ok: false, error: "Your account is not attached to an organisation." };
    if (peek.domain !== org.domain) return { ok: false, error: `This link was sent to an address outside @${org.domain}.` };
    const consumed = await consumeDomainMagicLink(parsed.data.token);
    if (!consumed || consumed.userId !== user.id) return { ok: false, error: "This link has expired or was already used." };

    const db = await getDb();
    const now = new Date();
    if (purpose === "company") {
      await db.update(companies).set({ domainVerifiedAt: org.domainVerifiedAt ?? now }).where(eq(companies.id, org.id));
    } else {
      await db.update(colleges).set({ domainVerifiedAt: org.domainVerifiedAt ?? now }).where(eq(colleges.id, org.id));
    }
    await db.update(users).set({ domainVerification: "verified" }).where(eq(users.id, user.id));
    await db.insert(notifications).values({
      userId: user.id,
      type: "domain.verified",
      title: `${org.name} verified at @${org.domain}`,
      body: purpose === "company" ? "Candidates now see your messages and invites as coming from a verified company." : "Recruiters now see your drives as coming from a verified placement cell.",
      href: HOME[purpose],
    });
    revalidatePath(`/${ROLE[purpose]}`, "layout");
    return { ok: true, domain: org.domain, name: org.name };
  } catch (err) {
    return failFrom(err);
  }
}
