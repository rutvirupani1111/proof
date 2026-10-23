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

/* ------------------------------------------------------------------ proofs hub + skill checks */

export const githubUsernameSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Enter your GitHub username.")
    .max(39)
    .regex(/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i, "That is not a valid GitHub username."),
});

export const importRepoSchema = z.object({
  fullName: z
    .string()
    .trim()
    .regex(/^[\w.-]+\/[\w.-]+$/, "Use the owner/name form, e.g. octocat/hello-world."),
});

export const addDeploymentSchema = z.object({
  url: z.string().trim().min(4, "Enter the URL of something you shipped.").max(300),
  repoId: z.string().uuid().nullish(),
});

export const deploymentIdSchema = z.object({ deploymentId: z.string().uuid() });

export const requestEndorsementSchema = z
  .object({
    mentorId: z.string().uuid("Choose a mentor."),
    subjectType: z.enum(["skill", "project"]),
    skillId: z.string().uuid().nullish(),
    repoId: z.string().uuid().nullish(),
    relationship: z.string().trim().min(3, "Say how they know your work.").max(160),
  })
  .refine((v) => (v.subjectType === "skill" ? !!v.skillId : !!v.repoId), {
    message: "Choose what they should endorse.",
    path: ["subject"],
  });

export const checkSlugSchema = z.object({ slug: z.string().regex(/^[a-z0-9-]{2,60}$/) });

export const runCodeSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,60}$/),
  code: z.string().max(20_000, "Keep the solution under 20,000 characters."),
});

export const submitAttemptSchema = z.object({
  attemptId: z.string().uuid(),
  code: z.string().max(20_000, "Keep the solution under 20,000 characters."),
  pasteEvents: z.number().int().min(0).max(10_000),
  tabBlurs: z.number().int().min(0).max(10_000),
});

/**
 * Notification categories a student can mute. `prefix` matches `notifications.type`
 * ("message.new" -> "message"). Muted categories are still stored, just not shown in the bell.
 */
export const NOTIFICATION_CATEGORIES = [
  { key: "message", label: "Messages", description: "A recruiter wrote to you." },
  { key: "application", label: "Applications", description: "Your application moved to a new stage." },
  { key: "drive", label: "College drives", description: "You became eligible for, or were selected in, a drive." },
  { key: "evidence", label: "Verified evidence", description: "A proof was verified and your score changed." },
  { key: "attestation", label: "Endorsements", description: "A mentor endorsed, declined or revoked." },
  { key: "check", label: "Skill checks", description: "A recruiter invited you to a check, or an attempt finished." },
  { key: "college", label: "Placement cell nudges", description: "Next-step suggestions from your placement cell." },
] as const;
export const NOTIFICATION_KEYS = NOTIFICATION_CATEGORIES.map((c) => c.key) as [
  (typeof NOTIFICATION_CATEGORIES)[number]["key"],
  ...(typeof NOTIFICATION_CATEGORIES)[number]["key"][],
];

export const studentAccountSchema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters").max(80, "Keep it under 80 characters"),
});

export const studentPrivacySchema = z.object({
  visibility: z.enum(VISIBILITIES),
  openToWork: z.boolean(),
});

export const studentNotificationsSchema = z.object({
  muted: z.array(z.enum(NOTIFICATION_KEYS)).max(NOTIFICATION_CATEGORIES.length),
});

export const driveRegistrationSchema = z.object({ driveId: z.string().trim().min(1).max(80) });
