"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { otpErrorMessage } from "@/components/auth/code-delivery";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";
import { RESET_EMAIL_KEY, forgotPasswordSchema } from "@/lib/validation/auth";

/** Step 1 of 2: ask for the account email, then hand over to /reset-password with a code. */
export function ForgotPasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = forgotPasswordSchema.safeParse({ email: new FormData(e.currentTarget).get("email") });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Enter a valid email.");
    setError(null);
    setPending(true);
    const { error: err } = await authClient.emailOtp.requestPasswordReset({ email: parsed.data.email });
    if (err) {
      setPending(false);
      return setError(otpErrorMessage(err).message);
    }
    try {
      sessionStorage.setItem(RESET_EMAIL_KEY, parsed.data.email);
    } catch {
      // Private mode: the reset screen asks for the email again.
    }
    router.push("/reset-password");
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Forgot your password?</h1>
      <p className="mt-2 text-sm text-muted">Enter your account email and we&apos;ll send a 6-digit code to choose a new one.</p>
      <form onSubmit={onSubmit} noValidate className="mt-8 grid gap-4">
        <Field label="Email" htmlFor="email" error={error ?? undefined}>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@college.edu"
            autoFocus
            required
            aria-invalid={!!error}
          />
        </Field>
        <Button type="submit" size="lg" loading={pending} className="mt-2 w-full">
          Send reset code
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-ink underline underline-offset-4 hover:text-violet-text">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
