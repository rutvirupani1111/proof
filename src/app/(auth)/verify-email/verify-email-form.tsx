"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CodeDeliveryNote, formatClock, otpErrorMessage, useCooldown, useCountdown } from "@/components/auth/code-delivery";
import { OtpInput } from "@/components/auth/otp-input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { authClient, signOut } from "@/lib/auth/client";
import { verificationCodeStatus, type CodeDelivery } from "@/server/email/actions";

const RESEND_COOLDOWN = 60;

export function VerifyEmailForm({ email, home, expiresIn, attempts }: { email: string; home: string; expiresIn: number; attempts: number }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sending, setSending] = useState(false);
  const [left, setLeft] = useState(attempts);
  const [burned, setBurned] = useState(false);
  const [delivery, setDelivery] = useState<CodeDelivery | null>(null);
  const [cooldownFrom, setCooldownFrom] = useState<number | null>(null);
  const sentAt = delivery && (delivery.state === "sent" || delivery.state === "onscreen") ? delivery.sentAt : null;
  const remaining = useCountdown(sentAt, expiresIn);
  const cooldown = useCooldown(cooldownFrom, RESEND_COOLDOWN);
  const expired = remaining === 0;

  const resend = useCallback(async () => {
    setSending(true);
    setError(null);
    const { error: err } = await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" });
    setSending(false);
    if (err) return setError(otpErrorMessage(err).message);
    const status = await verificationCodeStatus();
    setDelivery(status);
    setCooldownFrom(Date.now());
    if (status?.state === "sent" || status?.state === "onscreen") {
      setCode("");
      setLeft(attempts);
      setBurned(false);
      if (status.state === "sent") toast.success(`New code sent to ${email}`);
    }
  }, [email, attempts]);

  // The sign-up already sent a code: show where it went. No recent code (e.g. signed in later)? Send one.
  useEffect(() => {
    let live = true;
    verificationCodeStatus().then((status) => {
      if (!live) return;
      if (!status || status.state === "none") void resend();
      else {
        setDelivery(status);
        if (status.state === "sent" || status.state === "onscreen") setCooldownFrom(new Date(status.sentAt).getTime());
      }
    });
    return () => {
      live = false;
    };
  }, [resend]);

  async function verify(otp = code) {
    if (otp.length !== 6 || pending || burned) return;
    setPending(true);
    setError(null);
    const { error: err } = await authClient.emailOtp.verifyEmail({ email, otp });
    if (err) {
      setPending(false);
      const { message, burned: dead } = otpErrorMessage(err);
      const nextLeft = dead ? 0 : left - 1;
      setLeft(nextLeft);
      setBurned(dead || nextLeft <= 0);
      setCode("");
      return setError(nextLeft <= 0 && !dead ? "Too many wrong attempts. Send a new code to try again." : message);
    }
    toast.success("Email verified. Welcome to Proof!");
    router.replace(home);
    router.refresh();
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Check your email</h1>
      <p className="mt-2 text-sm text-muted">
        Enter the 6-digit code we sent to <span className="font-medium break-all text-ink">{email}</span> to finish creating your account.
      </p>
      <form
        className="mt-8 grid gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void verify();
        }}
      >
        <OtpInput value={code} onChange={setCode} onComplete={(v) => void verify(v)} disabled={pending || burned} invalid={!!error} />
        <div className="flex items-center justify-between text-xs text-muted" aria-live="polite">
          <span>{remaining == null ? "" : expired ? "Code expired" : `Expires in ${formatClock(remaining)}`}</span>
          <span>{burned ? "No attempts left" : `${left} attempt${left === 1 ? "" : "s"} left`}</span>
        </div>
        <CodeDeliveryNote delivery={delivery} onUse={(c) => { setCode(c); void verify(c); }} />
        {error && (
          <p role="alert" className="rounded-xl border border-coral/30 bg-coral-soft px-3 py-2 text-sm text-coral-text">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" loading={pending} disabled={code.length !== 6 || burned || expired} className="mt-2 w-full">
          Verify email
        </Button>
      </form>
      <div className="mt-6 flex items-center justify-between text-sm">
        <Button variant="link" type="button" onClick={() => void resend()} disabled={sending || cooldown > 0}>
          {cooldown > 0 ? `Resend code in ${cooldown}s` : sending ? "Sending..." : "Resend code"}
        </Button>
        <Button
          variant="link"
          type="button"
          className="text-muted"
          onClick={async () => {
            await signOut();
            router.replace("/signup");
            router.refresh();
          }}
        >
          Use a different email
        </Button>
      </div>
    </div>
  );
}
