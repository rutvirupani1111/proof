/**
 * Email configuration, read from env at call time (pure: pass `env` in tests).
 *
 *   RESEND_API_KEY  secret, Vercel env only.
 *   EMAIL_FROM      sender, e.g. "Name <noreply@your-domain>". Env only, never hardcoded: set it
 *                   once that domain is verified in Resend.
 *
 * Email counts as configured only when BOTH are set. Otherwise (or while Resend rejects the
 * sender domain) the on-screen fallback applies: the code or link is shown in the UI with an
 * "email not configured yet" note in demo mode (NEXT_PUBLIC_DEMO_MODE=true) or outside
 * production builds, and a friendly error everywhere else.
 *
 * Password-reset codes are the exception: they are shown on screen only outside production
 * builds. On the live demo showcase anyone can type any address, so an on-screen reset code
 * would let them take over a real account.
 */
import "server-only";

export type EmailConfig = {
  apiKey: string | null;
  from: string | null;
  /** True only when both the key and the sender are set. */
  configured: boolean;
  /** May the code / link be shown on screen when the email cannot be sent? */
  fallbackVisible: boolean;
  /** Same, for password-reset codes: development and tests only, never a production build. */
  resetFallbackVisible: boolean;
};

type Env = Record<string, string | undefined>;

export function emailConfig(env: Env = process.env, demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true"): EmailConfig {
  const apiKey = env.RESEND_API_KEY?.trim() || null;
  const from = env.EMAIL_FROM?.trim() || null;
  return {
    apiKey,
    from,
    configured: !!apiKey && !!from,
    fallbackVisible: demoMode || env.NEXT_PUBLIC_DEMO_MODE === "true" || env.NODE_ENV !== "production",
    resetFallbackVisible: env.NODE_ENV !== "production",
  };
}

/** Why email is not configured, for logs and the delivery record. Null when it is. */
export function notConfiguredReason(cfg: Pick<EmailConfig, "apiKey" | "from">): string | null {
  if (!cfg.apiKey && !cfg.from) return "Email is not configured yet (RESEND_API_KEY and EMAIL_FROM are not set).";
  if (!cfg.apiKey) return "Email is not configured yet (RESEND_API_KEY is not set).";
  if (!cfg.from) return "Email is not configured yet (EMAIL_FROM is not set).";
  return null;
}
