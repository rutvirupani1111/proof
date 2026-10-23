/**
 * Jobs board + applications tracker reads for ONE student. Always pass the session user's id.
 * The evidence match is computed here, server-side, from profile_skills and the Proof Score.
 */
import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  applications,
  companies,
  jobs,
  profileSkills,
  skills,
  studentProfiles,
  type ApplicationStage,
} from "@/db/schema";

export type Requirement = { label: string; skillSlug: string | null; min: number; have: number; met: boolean };

export type BoardJob = {
  id: string;
  title: string;
  description: string;
  location: string;
  workMode: "onsite" | "hybrid" | "remote";
  employmentType: "full_time" | "internship" | "contract";
  salaryMin: number | null;
  salaryMax: number | null;
  openings: number;
  applyBy: string | null;
  createdAt: string;
  company: { name: string; slug: string; city: string | null; industry: string | null; verified: boolean };
  requirements: Requirement[];
  /** 0-100: share of requirements the student's evidence already meets. */
  match: number;
  application: { id: string; stage: ApplicationStage } | null;
};

export async function getJobsBoard(userId: string): Promise<{ jobs: BoardJob[]; proofScore: number }> {
  const db = await getDb();
  const [rows, profile, mySkills, allSkills, myApps] = await Promise.all([
    db
      .select({ job: jobs, company: companies })
      .from(jobs)
      .innerJoin(companies, eq(companies.id, jobs.companyId))
      .where(eq(jobs.status, "open"))
      .orderBy(desc(jobs.createdAt)),
    db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.userId, userId),
      columns: { proofScore: true },
    }),
    db
      .select({ slug: skills.slug, score: profileSkills.proofScore })
      .from(profileSkills)
      .innerJoin(skills, eq(skills.id, profileSkills.skillId))
      .where(eq(profileSkills.userId, userId)),
    db.select({ slug: skills.slug, name: skills.name }).from(skills),
    db
      .select({ id: applications.id, jobId: applications.jobId, stage: applications.stage })
      .from(applications)
      .where(eq(applications.studentUserId, userId)),
  ]);

  const proofScore = profile?.proofScore ?? 0;
  const scoreBySlug = new Map(mySkills.map((s) => [s.slug, s.score]));
  const nameBySlug = new Map(allSkills.map((s) => [s.slug, s.name]));
  const appByJob = new Map(myApps.map((a) => [a.jobId, a]));

  const out = rows.map(({ job, company }): BoardJob => {
    const requirements: Requirement[] = job.requiredSkills.map((r) => {
      const have = scoreBySlug.get(r.skillSlug) ?? 0;
      return { label: nameBySlug.get(r.skillSlug) ?? r.skillSlug, skillSlug: r.skillSlug, min: r.minScore, have, met: have >= r.minScore };
    });
    if (job.minProofScore > 0) {
      requirements.unshift({ label: "Overall Proof Score", skillSlug: null, min: job.minProofScore, have: proofScore, met: proofScore >= job.minProofScore });
    }
    const met = requirements.filter((r) => r.met).length;
    const app = appByJob.get(job.id);
    return {
      id: job.id,
      title: job.title,
      description: job.description,
      location: job.location,
      workMode: job.workMode,
      employmentType: job.employmentType,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      openings: job.openings,
      applyBy: job.applyBy?.toISOString() ?? null,
      createdAt: job.createdAt.toISOString(),
      company: {
        name: company.name,
        slug: company.slug,
        city: company.city,
        industry: company.industry,
        verified: !!company.domainVerifiedAt,
      },
      requirements,
      match: requirements.length ? Math.round((met / requirements.length) * 100) : 100,
      application: app ? { id: app.id, stage: app.stage } : null,
    };
  });
  return { jobs: out, proofScore };
}

export type TrackedApplication = {
  id: string;
  stage: ApplicationStage;
  coverNote: string | null;
  appliedAt: string;
  updatedAt: string;
  job: { id: string; title: string; location: string; employmentType: string; workMode: string; status: string };
  company: { name: string; verified: boolean };
};

export async function getApplications(userId: string): Promise<TrackedApplication[]> {
  const db = await getDb();
  const rows = await db
    .select({ app: applications, job: jobs, company: companies })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(companies, eq(companies.id, jobs.companyId))
    .where(eq(applications.studentUserId, userId))
    .orderBy(desc(applications.updatedAt));
  return rows.map(({ app, job, company }) => ({
    id: app.id,
    stage: app.stage,
    coverNote: app.coverNote,
    appliedAt: app.appliedAt.toISOString(),
    updatedAt: app.updatedAt.toISOString(),
    job: { id: job.id, title: job.title, location: job.location, employmentType: job.employmentType, workMode: job.workMode, status: job.status },
    company: { name: company.name, verified: !!company.domainVerifiedAt },
  }));
}
