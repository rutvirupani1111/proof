/** Org lookup for company / college domain verification (session-derived ids only). */
import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { colleges, companies } from "@/db/schema";

/** The organisation the session user belongs to, from the session only. */
export type OrgPurpose = "company" | "college";

export async function orgOf(purpose: OrgPurpose, user: { companyId?: unknown; collegeId?: unknown }) {
  const db = await getDb();
  if (purpose === "company") {
    const id = user.companyId as string | null | undefined;
    if (!id) return null;
    const c = await db.query.companies.findFirst({ where: eq(companies.id, id), columns: { id: true, domain: true, domainVerifiedAt: true, name: true } });
    return c ?? null;
  }
  const id = user.collegeId as string | null | undefined;
  if (!id) return null;
  const c = await db.query.colleges.findFirst({ where: eq(colleges.id, id), columns: { id: true, domain: true, domainVerifiedAt: true, name: true } });
  return c ?? null;
}

