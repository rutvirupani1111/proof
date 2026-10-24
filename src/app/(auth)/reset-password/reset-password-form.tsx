"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CodeDeliveryNote, formatClock, otpErrorMessage, useCooldown, useCountdown } from "@/components/auth/code-delivery";
import { OtpInput } from "@/components/auth/otp-input";
import { PasswordStrength } from "@/components/auth/password-strength";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { toast } from "@/components/ui/toast";
import { authClient } from "@/lib/auth/client";
import { RESET_EMAIL_KEY, fieldErrors, resetPasswordSchema } from "@/lib/validation/auth";
import { resetCodeStatus, type CodeDelivery } from "@/server/email/actions";

const RESEND_COOLDOWN = 60;
const OTP_CODES = ["INVALID_OTP", "OTP_EXPIRED", "TOO_MANY_ATTEMPTS"];

/** Step 2 of 2: the emailed code + a new password. Success signs the account out everywhere. */
export function ResetPasswordForm({ expiresIn, attempts }: { expiresIn: number; attempts: number }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [sending, setSending] = useState(false);
  const [left, setLeft] = useState(attempts);
  const [burned, setBurned] = useState(false);
  const [delivery, setDelivery] = useState<CodeDelivery | null>(null);
  const [cooldownFrom, setCooldownFrom] = useState<number | null>(null);
  const sentAt = delivery && (delivery.state === "sent" || delivery.state === "onscreen") ? delivery.sentAt : null;
  const remaining = useCountdown(sentAt, expiresIn);
  const cooldown = useCooldown(cooldownFrom, RESEND_COOLDOWN);

  const refresh = useCallback(async (address: string) => {
    if (!address) return;
    const status = await resetCodeStatus(address);
    setDelivery(status);
    if (status?.state === "sent" || status?.state === "onscreen") setCooldownFrom(new Date(status.sentAt).getTime());
  }, []);

  useEffect(() => {
    let stored = "";
    try {
      stored = sessionStorage.getItem(RESET_EMAIL_KEY) ?? "";
    } catch {
      // Ignore: the email field stays editable.
    }
    if (!stored) return;
    // After hydration (the server render has no sessionStorage), so the input never mismatches.
    queueMicrotask(() => {
      setEmail(stored);
      void refresh(stored);
    });
  }, [refresh]);

  async function resend() {
    if (!email) return setErrors({ email: "Enter your account email." });
    setSending(true);
    const { error } = await authClient.emailOtp.requestPasswordReset({ email });
    setSending(false);
    if (error) return setErrors({ form: otpErrorMessage(error).message });
    setErrors({});
    setCode("");
    setLeft(attempts);
    setBurned(false);
    setCooldownFrom(Date.now());
    await refresh(email);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = resetPasswordSchema.safeParse({ email, otp: code, password });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setPending(true);
    const { error } = await authClient.emailOtp.resetPassword(parsed.data);
    setPending(false);
    if (error) {
      const { message, burned: dead } = otpErrorMessage(error);
      if (OTP_CODES.includes(error.code ?? "") || error.status === 403) {
        const nextLeft = dead ? 0 : left - 1;
        setLeft(nextLeft);
        setBurned(dead || nextLeft <= 0);
        setCode("");
      }
      // Unknown account: same wording as a wrong code, so the form never confirms who has an account.
      return setErrors({ form: error.code === "USER_NOT_FOUND" ? "That code isn't right. Check the digits and try again." : message });
    }
    try {
      sessionStorage.removeItem(RESET_EMAIL_KEY);
    } catch {
      // Ignore.
    }
    toast.success("Password updated. You've been signed out on every device.");
    router.replace("/login");
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Choose a new password</h1>
      <p className="mt-2 text-sm text-muted">If an account exists for this email, we sent it a 6-digit code. Enter it with your new password.</p>
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => void refresh(email)}
            required
            aria-invalid={!!errors.email}
          />
        </Field>
        <div className="grid gap-1.5">
          <span className="text-sm font-medium text-ink">Code</span>
          <OtpInput value={code} onChange={setCode} disabled={pending || burned} invalid={!!errors.otp} autoFocus={!!email} idPrefix="reset-otp" />
          <div className="flex items-center justify-between text-xs text-muted" aria-live="polite">
            <span>{remaining == null ? "" : remaining === 0 ? "Code expired" : `Expires in ${formatClock(remaining)}`}</span>
            <span>{burned ? "No attempts left" : `${left} attempt${left === 1 ? "" : "s"} left`}</span>
          </div>
          {errors.otp && <p className="text-xs text-coral-text">{errors.otp}</p>}
        </div>
        <CodeDeliveryNote delivery={delivery} onUse={setCode} />
        <Field label="New password" htmlFor="password" error={errors.password}>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            aria-invalid={!!errors.password}
            aria-describedby="password-strength"
          />
        </Field>
        <PasswordStrength password={password} id="password-strength" />
        {errors.form && (
          <p role="alert" className="rounded-xl border border-coral/30 bg-coral-soft px-3 py-2 text-sm text-coral-text">
            {errors.form}
          </p>
        )}
        <Button type="submit" size="lg" loading={pending} disabled={burned} className="mt-2 w-full">
          Reset password
        </Button>
      </form>
      <div className="mt-6 flex items-center justify-between text-sm">
        <Button variant="link" type="button" onClick={() => void resend()} disabled={sending || cooldown > 0}>
          {cooldown > 0 ? `Resend code in ${cooldown}s` : sending ? "Sending..." : "Send a new code"}
        </Button>
        <Link href="/login" className="text-muted hover:text-ink">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
