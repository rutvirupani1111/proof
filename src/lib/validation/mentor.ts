import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

export const mentorProfileSchema = z.object({
  title: z.string().trim().min(2, "Add your title, e.g. Associate Professor.").max(80),
  organization: z.string().trim().min(2, "Name your college or company.").max(120),
  orgType: z.enum(["college", "company"], { message: "Choose college or company." }),
  bio: optionalText(400),
});
export type MentorProfileInput = z.input<typeof mentorProfileSchema>;

export const STATEMENT_MIN = 40;
export const STATEMENT_MAX = 600;

const statement = z
  .string()
  .trim()
  .min(STATEMENT_MIN, `Say what you saw them build, in at least ${STATEMENT_MIN} characters.`)
  .max(STATEMENT_MAX, `Keep it under ${STATEMENT_MAX} characters.`);
const relationship = z
  .string()
  .trim()
  .min(3, "How do you know their work? e.g. Guided their final-year project.")
  .max(120);
const id = z.string().trim().min(1, "Missing request.").max(64);

export const endorseSchema = z.object({ attestationId: id, statement, relationship });
export type EndorseInput = z.input<typeof endorseSchema>;

export const declineSchema = z.object({ attestationId: id, note: optionalText(300) });
export type DeclineInput = z.input<typeof declineSchema>;

export const revokeSchema = z.object({ attestationId: id });

export const directEndorseSchema = z.object({
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .transform((v) => v.replace(/^@/, "").replace(/^.*\/u\//, ""))
    .pipe(z.string().regex(/^[a-z0-9-]{2,40}$/, "Enter the student's Proof handle, e.g. ishita-varma.")),
  skillSlug: z.string().trim().min(1, "Choose the skill you are vouching for.").max(40),
  statement,
  relationship,
});
export type DirectEndorseInput = z.input<typeof directEndorseSchema>;

export const domainTokenSchema = z.object({ token: z.string().trim().min(20).max(600) });
