import { z } from "zod";

/** Accent keys map to design tokens, never raw colours. */
export const ACCENTS = ["lime", "violet", "coral", "ink"] as const;
export type Accent = (typeof ACCENTS)[number];
export const VISIBILITIES = ["public", "recruiters", "hidden"] as const;

const roleList = z
  .array(z.string().trim().min(2, "Too short").max(48, "Keep roles under 48 characters"))
  .max(6, "Pick up to 6 roles");

const thisYear = new Date().getFullYear();

export const onboardingCollegeSchema = z.object({
  collegeId: z.string().min(1, "Choose your college"),
  graduationYear: z.coerce
    .number()
    .int()
    .min(thisYear - 2, "That year looks too early")
    .max(thisYear + 6, "That year looks too far away"),
  degree: z.string().trim().min(2, "Add your degree").max(60),
  branch: z.string().trim().min(2, "Add your branch").max(80),
});

export const onboardingRolesSchema = z.object({
  targetRoles: roleList.min(1, "Pick at least one role"),
});

export const onboardingSkillsSchema = z.object({
  skillIds: z.array(z.string().min(1)).min(1, "Pick at least one skill to prove").max(12, "Pick up to 12 skills"),
});

export const profileSchema = z.object({
  headline: z.string().trim().max(120, "Keep the headline under 120 characters").default(""),
  about: z.string().trim().max(1200, "Keep it under 1200 characters").default(""),
  location: z.string().trim().max(80).default(""),
  targetRoles: roleList.default([]),
  openToWork: z.boolean(),
  accentColor: z.enum(ACCENTS),
  visibility: z.enum(VISIBILITIES),
  pinnedEvidenceIds: z.array(z.string().min(1)).max(3, "Pin up to 3 pieces of evidence"),
});
export type ProfileInput = z.input<typeof profileSchema>;

export const applySchema = z.object({
  jobId: z.string().min(1),
  coverNote: z.string().trim().max(1000, "Keep the note under 1000 characters").optional(),
});

export const withdrawSchema = z.object({
  applicationId: z.string().min(1),
});
