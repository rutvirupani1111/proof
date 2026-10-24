"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { signIn } from "@/lib/auth/client";
import { homeFor, safeNext } from "@/lib/auth/roles";
import { fieldErrors, loginSchema } from "@/lib/validation/auth";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setPending(true);
    const { data, error } = await signIn.email(parsed.data);
    if (error || !data) {
      setPending(false);
      return setErrors({ form: error?.message ?? "Could not sign in." });
    }
    router.replace(safeNext(params.get("next")) ?? homeFor(data.user.role));
    router.refresh();
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-sm text-muted">Sign in to your Proof account.</p>
      <form onSubmit={onSubmit} noValidate className="mt-8 grid gap-4">
        <Field label="Email" htmlFor="email" error={errors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@college.edu"
            required
            aria-invalid={!!errors.email}
          />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password}>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            placeholder="Your password"
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
          Sign in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        New to Proof?{" "}
        <Link href="/signup" className="font-medium text-ink underline underline-offset-4 hover:text-violet-text">
          Create an account
        </Link>
      </p>
    </div>
  );
}
