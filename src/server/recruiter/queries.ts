import "server-only";
import { and, count, eq, gte } from "drizzle-orm";
import { getDb } from "@/db";
import { companies, jobs, pipelineCards, shortlists, studentProfiles } from "@/db/schema";

/** Dashboard summary scoped to the recruiter's company. */
export async function getRecruiterDashboard(companyId: string | null | undefined) {
  const db = await getDb();
  const [[searchable], [ready]] = await Promise.all([
    db.select({ n: count() }).from(studentProfiles).where(eq(studentProfiles.visibility, "public")),
    db.select({ n: count() }).from(studentProfiles).where(gte(studentProfiles.proofScore, 70)),
  ]);
  if (!companyId) {
    return { company: null, openJobs: 0, pipeline: 0, shortlists: 0, searchable: searchable?.n ?? 0, ready: ready?.n ?? 0 };
  }
  const [company, [open], [pipe], [lists]] = await Promise.all([
    db.query.companies.findFirst({ where: eq(companies.id, companyId) }),
    db.select({ n: count() }).from(jobs).where(and(eq(jobs.companyId, companyId), eq(jobs.status, "open"))),
    db.select({ n: count() }).from(pipelineCards).where(eq(pipelineCards.companyId, companyId)),
    db.select({ n: count() }).from(shortlists).where(eq(shortlists.companyId, companyId)),
  ]);
  return {
    company: company ?? null,
    openJobs: open?.n ?? 0,
    pipeline: pipe?.n ?? 0,
    shortlists: lists?.n ?? 0,
    searchable: searchable?.n ?? 0,
    ready: ready?.n ?? 0,
  };
}
