"use client";

import { Building2, GraduationCap, Landmark, UserRoundCheck, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { springs } from "@/components/motion/transitions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { signUp } from "@/lib/auth/client";
import { homeFor, SIGNUP_ROLES, type SignupRole } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import { fieldErrors, signupSchema } from "@/lib/validation/auth";

const ROLE_CARDS: Record<SignupRole, { icon: LucideIcon; title: string; blurb: string; emailHint: string; emailPlaceholder: string }> = {
  student: {
    icon: GraduationCap,
    title: "Student",
    blurb: "Prove your skills, get found.",
    emailHint: "Any email works. Your college email links you to your cohort.",
    emailPlaceholder: "you@college.edu",
  },
  recruiter: {
    icon: Building2,
    title: "Recruiter",
    blurb: "Search verified evidence.",
    emailHint: "Use your work email. We verify your company domain next.",
    emailPlaceholder: "you@company.com",
  },
  college: {
    icon: Landmark,
    title: "Placement cell",
    blurb: "See who is job-ready.",
    emailHint: "Use your college email. We verify the domain next.",
    emailPlaceholder: "placements@college.edu",
  },
  mentor: {
    icon: UserRoundCheck,
    title: "Mentor",
    blurb: "Vouch for real work.",
    emailHint: "Use your institutional email (college or company). We verify it next.",
    emailPlaceholder: "you@college.edu",
  },
};

export function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = params.get("role");
  const [role, setRole] = useState<SignupRole>(
    (SIGNUP_ROLES as readonly string[]).includes(initial ?? "") ? (initial as SignupRole) : "student",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = signupSchema.safeParse({
      role,
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setPending(true);
    const { error } = await signUp.email(parsed.data);
    if (error) {
      setPending(false);
      return setErrors({ form: error.message ?? "Could not create your account." });
    }
    router.replace(homeFor(parsed.data.role));
    router.refresh();
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-2 text-sm text-muted">Choose how you will use Proof.</p>

      <form onSubmit={onSubmit} noValidate className="mt-8 grid gap-4">
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium">I am a</legend>
          <div role="radiogroup" className="grid grid-cols-2 gap-2">
            {SIGNUP_ROLES.map((r) => {
              const { icon: Icon, title, blurb } = ROLE_CARDS[r];
              const active = role === r;
              return (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setRole(r)}
                  className={cn(
                    "relative rounded-xl border p-3 text-left transition-colors",
                    active ? "border-ink/60 bg-surface" : "border-line bg-surface/60 hover:border-line-strong",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="role-ring"
                      className="absolute inset-0 rounded-xl ring-2 ring-lime"
                      transition={springs.snappy}
                      aria-hidden
                    />
                  )}
                  <Icon className={cn("size-4", active ? "text-ink" : "text-subtle")} aria-hidden />
                  <span className="mt-2 block text-sm font-medium">{title}</span>
                  <span className="block text-xs text-muted">{blurb}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <Field label="Full name" htmlFor="name" error={errors.name}>
          <Input id="name" name="name" autoComplete="name" placeholder="e.g. Ishita Varma" required aria-invalid={!!errors.name} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email} hint={ROLE_CARDS[role].emailHint}>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={ROLE_CARDS[role].emailPlaceholder}
            required
            aria-invalid={!!errors.email}
          />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password} hint="At least 8 characters.">
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            minLength={8}
            required
            aria-invalid={!!errors.password}
          />
        </Field>
        {errors.form && (
          <p role="alert" className="rounded-xl border border-coral/30 bg-coral-soft px-3 py-2 text-sm text-coral-text">
            {errors.form}
          </p>
        )}
        <Button type="submit" size="lg" loading={pending} className="mt-2 w-full">
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already on Proof?{" "}
        <Link href="/login" className="font-medium text-ink underline underline-offset-4 hover:text-violet-text">
          Sign in
        </Link>
      </p>
    </div>
  );
}
