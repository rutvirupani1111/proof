/**
 * The delivery decision, pure and injectable (unit-tested in deliver.test.ts):
 *
 *   1. Per-recipient rate limit per template (RATE_LIMITS).
 *   2. Not configured (RESEND_API_KEY or EMAIL_FROM missing) or the provider rejects the sender domain / key
 *      -> "onscreen" when the fallback may be shown (demo mode or development; password-reset codes
 *      in development only), else "failed".
 *   3. Any other provider error -> "failed" with a friendly message.
 *
 * Every attempt is recorded, so the UI can ask "what happened to my last code?" and the rate
 * limit counts real attempts. The code / link (`reveal`) is stored only for "onscreen" rows.
 */
import "server-only";

export type TemplateKey = "verify-code" | "password-reset" | "domain-link" | "welcome" | "new-message";

export type EmailMessage = {
  to: string;
  template: TemplateKey;
  subject: string;
  html: string;
  text: string;
  /** What the on-screen fallback may show. Never stored when the email is really sent. */
  reveal?: { code?: string; link?: string };
};

export type DeliveryResult =
  | { status: "sent"; id: string }
  | { status: "onscreen"; reason: string; reveal: { code?: string; link?: string } }
  | { status: "failed"; reason: string; message: string }
  | { status: "rate_limited"; retryAfterSec: number; message: string };

/** Thrown by a transport. `kind` decides between fallback and a hard failure. */
export class EmailProviderError extends Error {
  constructor(
    public readonly kind: "domain" | "key" | "other",
    message: string,
  ) {
    super(message);
  }
}

export type Transport = {
  send(m: { from: string; to: string; subject: string; html: string; text: string }): Promise<{ id: string }>;
};

export type DeliveryRecord = {
  to: string;
  template: TemplateKey;
  subject: string;
  status: DeliveryResult["status"];
  reason: string | null;
  providerId: string | null;
  reveal: { code?: string; link?: string } | null;
};

export type DeliverDeps = {
  /** null = email not configured (no RESEND_API_KEY or no EMAIL_FROM). */
  transport: Transport | null;
  from: string | null;
  /** Logged / recorded when `transport` or `from` is missing. */
  notConfiguredReason?: string | null;
  fallbackVisible: boolean;
  /** Overrides `fallbackVisible` for password-reset codes. Missing = never shown. */
  resetFallbackVisible?: boolean;
  /** Attempts (excluding rate_limited ones) for this recipient + template since `since`. */
  recentCount(to: string, template: TemplateKey, since: Date): Promise<number>;
  record(row: DeliveryRecord): Promise<void>;
  now?: () => number;
};

/** max sends per window, per recipient and template. new-message batches a burst into one email. */
export const RATE_LIMITS: Record<TemplateKey, { max: number; windowSec: number }> = {
  "verify-code": { max: 5, windowSec: 10 * 60 },
  "password-reset": { max: 5, windowSec: 10 * 60 },
  "domain-link": { max: 5, windowSec: 10 * 60 },
  welcome: { max: 1, windowSec: 24 * 60 * 60 },
  "new-message": { max: 1, windowSec: 15 * 60 },
};

export const FRIENDLY_FAILURE = "We couldn't send the email right now. Please try again in a few minutes.";
export const NOT_CONFIGURED_REASON = "Email is not configured yet (RESEND_API_KEY or EMAIL_FROM is not set).";

export async function deliver(message: EmailMessage, deps: DeliverDeps): Promise<DeliveryResult> {
  const now = deps.now?.() ?? Date.now();
  const to = message.to.trim().toLowerCase();
  const limit = RATE_LIMITS[message.template];
  const base = { to, template: message.template, subject: message.subject, providerId: null, reveal: null };

  const used = await deps.recentCount(to, message.template, new Date(now - limit.windowSec * 1000));
  if (used >= limit.max) {
    await deps.record({ ...base, status: "rate_limited", reason: `limit ${limit.max}/${limit.windowSec}s` });
    const mins = Math.ceil(limit.windowSec / 60);
    return {
      status: "rate_limited",
      retryAfterSec: limit.windowSec,
      message: `Too many emails to this address. Try again in ${mins >= 60 ? `${Math.round(mins / 60)} hours` : `${mins} minutes`}.`,
    };
  }

  const fallback = async (reason: string): Promise<DeliveryResult> => {
    const visible = message.template === "password-reset" ? !!deps.resetFallbackVisible : deps.fallbackVisible;
    if (visible) {
      const reveal = message.reveal ?? {};
      await deps.record({ ...base, status: "onscreen", reason, reveal });
      return { status: "onscreen", reason, reveal };
    }
    await deps.record({ ...base, status: "failed", reason });
    return { status: "failed", reason, message: FRIENDLY_FAILURE };
  };

  if (!deps.transport || !deps.from) return fallback(deps.notConfiguredReason ?? NOT_CONFIGURED_REASON);

  try {
    const { id } = await deps.transport.send({ from: deps.from, to, subject: message.subject, html: message.html, text: message.text });
    await deps.record({ ...base, status: "sent", reason: null, providerId: id });
    return { status: "sent", id };
  } catch (err) {
    if (err instanceof EmailProviderError && err.kind !== "other") {
      return fallback(
        err.kind === "domain"
          ? `The sending domain is not verified in Resend yet (${err.message}).`
          : `The Resend API key was rejected (${err.message}).`,
      );
    }
    const reason = err instanceof Error ? err.message : String(err);
    await deps.record({ ...base, status: "failed", reason });
    return { status: "failed", reason, message: FRIENDLY_FAILURE };
  }
}

/**
 * Classifies a Resend error. 403s and "domain is not verified" / "testing emails" / invalid
 * sender messages mean the domain is not ready; missing / invalid / restricted keys mean the key.
 */
export function classifyResendError(err: { name?: string; message?: string; statusCode?: number | null }): EmailProviderError {
  const name = (err.name ?? "").toLowerCase();
  const msg = err.message ?? "Unknown Resend error";
  if (/(missing|invalid|restricted)_api_key/.test(name) || err.statusCode === 401) return new EmailProviderError("key", msg);
  if (name === "invalid_from_address" || /domain|not verified|testing emails|own email address/i.test(msg) || err.statusCode === 403) {
    return new EmailProviderError("domain", msg);
  }
  return new EmailProviderError("other", msg);
}
