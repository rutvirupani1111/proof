"use client";

import { Copy, MailCheck, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "@/components/ui/toast";
import type { CodeDelivery } from "@/server/email/actions";

/** Where the code went: inbox, on screen (email not configured yet), or a friendly failure. */
export function CodeDeliveryNote({ delivery, onUse }: { delivery: CodeDelivery | null; onUse?: (code: string) => void }) {
  if (!delivery || delivery.state === "none") return null;
  if (delivery.state === "sent") {
    return (
      <p className="flex items-start gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-muted">
        <MailCheck className="mt-0.5 size-4 shrink-0 text-verified" aria-hidden />
        <span>
          Sent to <span className="font-medium break-all text-ink">{delivery.email}</span>. Check spam if it isn&apos;t there in a minute.
        </span>
      </p>
    );
  }
  if (delivery.state === "onscreen") {
    return (
      <div role="status" className="rounded-xl border border-violet/30 bg-violet/5 px-3 py-3 text-sm">
        <p className="font-medium text-ink">Email not configured yet</p>
        <p className="mt-0.5 text-muted">{delivery.note}</p>
        {delivery.code && (
          <div className="mt-2 flex items-center gap-2">
            <code className="rounded-lg border border-line bg-surface px-3 py-1.5 font-mono text-lg font-semibold tracking-[0.3em] text-ink">{delivery.code}</code>
            {onUse && (
              <button type="button" className="text-sm font-medium text-violet-text hover:underline" onClick={() => onUse(delivery.code!)}>
                Use code
              </button>
            )}
            <button
              type="button"
              aria-label="Copy code"
              className="rounded-md p-1 text-muted hover:text-ink"
              onClick={() => navigator.clipboard?.writeText(delivery.code!).then(() => toast.success("Code copied"), () => undefined)}
            >
              <Copy className="size-4" aria-hidden />
            </button>
          </div>
        )}
      </div>
    );
  }
  return (
    <p role="alert" className="flex items-start gap-2 rounded-xl border border-coral/30 bg-coral-soft px-3 py-2 text-sm text-coral-text">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{delivery.message}</span>
    </p>
  );
}

/** mm:ss until `sentAt + seconds`; null once expired or before anything was sent. */
export function useCountdown(sentAt: string | null, seconds: number): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!sentAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [sentAt]);
  if (!sentAt) return null;
  const left = Math.round((new Date(sentAt).getTime() + seconds * 1000 - now) / 1000);
  return left > 0 ? left : 0;
}

export function formatClock(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Seconds left on a resend cooldown that starts whenever `startedAt` changes. */
export function useCooldown(startedAt: number | null, seconds: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  if (!startedAt) return 0;
  return Math.max(0, Math.ceil((startedAt + seconds * 1000 - now) / 1000));
}

/** Better Auth OTP error -> what to tell the person. */
export function otpErrorMessage(err: { code?: string; message?: string; status?: number } | null | undefined): { message: string; burned: boolean } {
  const code = err?.code ?? "";
  if (code === "TOO_MANY_ATTEMPTS" || err?.status === 403) return { message: "Too many wrong attempts. Send a new code to try again.", burned: true };
  if (code === "OTP_EXPIRED") return { message: "That code has expired. Send a new one.", burned: true };
  if (code === "INVALID_OTP") return { message: "That code isn't right. Check the digits and try again.", burned: false };
  if (err?.status === 429) return { message: "Too many requests. Wait a minute and try again.", burned: false };
  return { message: err?.message ?? "Something went wrong. Try again.", burned: false };
}
