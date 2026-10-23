import { z } from "zod";
import { SIGNUP_ROLES } from "@/lib/auth/roles";

export const loginSchema = z.object({
  email: z.email("Enter a valid email."),
  password: z.string().min(1, "Enter your password."),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  role: z.enum(SIGNUP_ROLES),
  name: z.string().trim().min(2, "Enter your full name.").max(80),
  email: z.email("Enter a valid email."),
  password: z.string().min(8, "Use at least 8 characters.").max(128),
});
export type SignupInput = z.infer<typeof signupSchema>;

/** Flatten a ZodError into { field: firstMessage } for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
