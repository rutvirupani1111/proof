import { z } from "zod";

export const DRIVE_STATUSES = ["planned", "open", "completed", "cancelled"] as const;
export const DRIVE_STUDENT_STATUSES = [
  "eligible",
  "registered",
  "shortlisted",
  "selected",
  "rejected",
  "absent",
] as const;
export type DriveStudentStatusId = (typeof DRIVE_STUDENT_STATUSES)[number];

const id = z.string().trim().min(1).max(64);

export const driveEligibilitySchema = z.object({
  minProofScore: z.coerce.number().int().min(0).max(100).optional(),
  graduationYears: z.array(z.coerce.number().int().min(2000).max(2100)).max(6).optional(),
  branches: z.array(z.string().trim().min(1).max(60)).max(12).optional(),
  skills: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
});
export type DriveEligibilityInput = z.infer<typeof driveEligibilitySchema>;

export const driveCreateSchema = z.object({
  companyName: z.string().trim().min(2, "Which company is visiting?").max(80),
  title: z.string().trim().min(3, "Give the drive a title.").max(100),
  scheduledAt: z.coerce.date({ error: "Pick a date." }),
  location: z.string().trim().max(80).optional(),
  eligibility: driveEligibilitySchema,
});
export type DriveCreateInput = z.infer<typeof driveCreateSchema>;

export const driveStatusSchema = z.object({ driveId: id, status: z.enum(DRIVE_STATUSES) });

export const driveStudentUpdateSchema = z.object({
  driveId: id,
  studentUserId: id,
  status: z.enum(DRIVE_STUDENT_STATUSES),
  result: z.string().trim().max(120).optional(),
});

export const NUDGE_GAPS = ["github", "repo", "deployment", "check", "endorsement"] as const;
export type NudgeGap = (typeof NUDGE_GAPS)[number];

export const nudgeSchema = z.object({
  studentUserIds: z.array(id).min(1, "Pick at least one student.").max(500),
  message: z.string().trim().max(280).optional(),
});
