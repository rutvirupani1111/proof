/**
 * Showcase demo accounts. Client + server safe (no secrets: the password is the public demo
 * password every seeded account uses). Everything here is inert unless the deployment opts in
 * with NEXT_PUBLIC_DEMO_MODE=true (committed in `.env.production` for the public showcase).
 */
import type { Role } from "@/lib/auth/roles";

/** Inlined at build time. Off in local dev and anywhere the flag is not exactly "true". */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

/** Mirrors `DEMO_PASSWORD` in scripts/seed-data.ts. */
export const DEMO_PASSWORD = "proof-demo-2026";

export type DemoAccount = {
  key: DemoKey;
  role: Role;
  /** Short role label for the card and the switcher. */
  label: string;
  name: string;
  email: string;
  /** One line on what this account shows off. */
  blurb: string;
};

export const DEMO_KEYS = ["student", "recruiter", "recruiter-pending", "college", "mentor", "admin"] as const;
export type DemoKey = (typeof DEMO_KEYS)[number];

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    key: "student",
    role: "student",
    label: "Student",
    name: "Ishita Varma",
    email: "ishita@spit-surat.example",
    blurb: "Proof Score, verified repos and a public profile.",
  },
  {
    key: "recruiter",
    role: "recruiter",
    label: "Recruiter (verified)",
    name: "Meera Iyer",
    email: "meera@kitecode.example",
    blurb: "Kitecode Labs: search, pipeline, interview kits.",
  },
  {
    key: "recruiter-pending",
    role: "recruiter",
    label: "Recruiter (pending)",
    name: "Arjun Kapoor",
    email: "arjun@monsoonpay.example",
    blurb: "Monsoonpay, domain still pending verification.",
  },
  {
    key: "college",
    role: "college",
    label: "Placement cell",
    name: "SPIT Surat",
    email: "placements@spit-surat.example",
    blurb: "Cohort stats, drives and nudges.",
  },
  {
    key: "mentor",
    role: "mentor",
    label: "Mentor",
    name: "Dr. Anand Mehta",
    email: "anand.mehta@spit-surat.example",
    blurb: "Verified at @spit-surat.example; endorses work.",
  },
  {
    key: "admin",
    role: "admin",
    label: "Admin",
    name: "Proof Admin",
    email: "admin@proof.example",
    blurb: "Passes every role check; opens every portal.",
  },
];

export function demoAccount(key: string): DemoAccount | undefined {
  return DEMO_ACCOUNTS.find((a) => a.key === key);
}

/** The demo account a signed-in email belongs to, if any. */
export function demoAccountForEmail(email: string | null | undefined): DemoAccount | undefined {
  if (!email) return undefined;
  const e = email.toLowerCase();
  return DEMO_ACCOUNTS.find((a) => a.email === e);
}
