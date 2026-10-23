import { z } from "zod";

/** Pipeline columns, in board order. Mirrors the `pipeline_stage` enum in src/db/schema.ts. */
export const PIPELINE_STAGES = [
  "sourced",
  "contacted",
  "skill_check",
  "interview",
  "offer",
  "hired",
  "rejected",
] as const;
export type PipelineStageId = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_STAGE_LABEL: Record<PipelineStageId, string> = {
  sourced: "Sourced",
  contacted: "Contacted",
  skill_check: "Skill check",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
  rejected: "Rejected",
};

export const SEARCH_SORTS = ["score", "relevance", "skill", "commits", "deployments"] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

const id = z.string().trim().min(1).max(64);
const year = z.coerce.number().int().min(2000).max(2100);

/** Recruiter evidence-search filters. Every field optional; unknown keys are dropped. */
export const searchFiltersSchema = z.object({
  q: z.string().trim().max(120).optional(),
  skills: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
  hasDeployment: z.boolean().optional(),
  minOwnCommits: z.coerce.number().int().min(0).max(100_000).optional(),
  passedCheck: z.boolean().optional(),
  mentorEndorsed: z.boolean().optional(),
  collegeIds: z.array(id).max(20).optional(),
  graduationYears: z.array(year).max(10).optional(),
  location: z.string().trim().max(60).optional(),
  sort: z.enum(SEARCH_SORTS).optional(),
});
export type SearchFiltersInput = z.infer<typeof searchFiltersSchema>;

export const saveSearchSchema = z.object({
  name: z.string().trim().min(2, "Name the search.").max(60),
  filters: searchFiltersSchema,
});

export const shortlistCreateSchema = z.object({
  name: z.string().trim().min(2, "Give the shortlist a name.").max(80),
  description: z.string().trim().max(240).optional(),
  jobId: id.optional(),
});

export const shortlistEntrySchema = z.object({ shortlistId: id, studentUserId: id });

export const JOB_WORK_MODES = ["onsite", "hybrid", "remote"] as const;
export const JOB_TYPES = ["full_time", "internship", "contract"] as const;

export const jobSchema = z
  .object({
    id: id.optional(),
    title: z.string().trim().min(3, "Add a job title.").max(100),
    description: z.string().trim().min(20, "Describe the role in at least 20 characters.").max(4000),
    location: z.string().trim().min(2, "Add a location.").max(80),
    workMode: z.enum(JOB_WORK_MODES),
    employmentType: z.enum(JOB_TYPES),
    salaryMin: z.coerce.number().int().min(0).max(100_000_000).optional(),
    salaryMax: z.coerce.number().int().min(0).max(100_000_000).optional(),
    minProofScore: z.coerce.number().int().min(0).max(100),
    openings: z.coerce.number().int().min(1).max(500),
    requiredSkills: z
      .array(z.object({ skillSlug: z.string().trim().min(1).max(40), minScore: z.coerce.number().int().min(0).max(100) }))
      .max(8),
    status: z.enum(["draft", "open"]).default("open"),
  })
  .refine((j) => j.salaryMin == null || j.salaryMax == null || j.salaryMax >= j.salaryMin, {
    message: "Maximum must be at least the minimum.",
    path: ["salaryMax"],
  });
export type JobInput = z.infer<typeof jobSchema>;

export const pipelineAddSchema = z.object({
  studentUserId: id,
  jobId: id.optional(),
  stage: z.enum(PIPELINE_STAGES).default("sourced"),
});

export const pipelineMoveSchema = z.object({
  cardId: id,
  stage: z.enum(PIPELINE_STAGES),
  /** Sparse float: the client computes a value between the new neighbours. */
  position: z.number().finite(),
});

export const inviteCheckSchema = z.object({ studentUserId: id, skillCheckId: id });

export const noteSchema = z.object({
  studentUserId: id,
  body: z.string().trim().min(1, "Write a note first.").max(2000),
});

export const messageSchema = z.object({
  recipientUserId: id,
  body: z.string().trim().min(1, "Write a message first.").max(2000),
});

export const inviteTeammateSchema = z.object({ email: z.email("Enter a valid work email.") });

export const compareIdsSchema = z.array(id).min(1).max(3);

/** What every recruiter / college / messaging server action returns to the client. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
