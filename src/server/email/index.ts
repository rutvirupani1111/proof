/**
 * THE mail adapter. Every email Proof sends goes through `sendEmail` (or `send`):
 *
 *   const res = await sendEmail({ to, template: "verify-code", ...verifyCodeEmail({ code, minutes: 10 }), reveal: { code } });
 *   // res.status: "sent" | "onscreen" (demo/dev fallback) | "failed" | "rate_limited"
 *
 * Resend when RESEND_API_KEY and EMAIL_FROM are both set (env only, see config.ts); otherwise, or
 * while the sender domain is not verified, the on-screen fallback in demo mode / development and
 * a friendly error elsewhere (see deliver.ts).
 */
import "server-only";
import { and, desc, eq, gte, ne, sql } from "drizzle-orm";
import { Resend } from "resend";
import { getDb } from "@/db";
import { emailDeliveries } from "@/db/schema";
import { emailConfig, notConfiguredReason } from "./config";
import { classifyResendError, deliver, type DeliveryResult, type EmailMessage, type TemplateKey, type Transport } from "./deliver";

export type { DeliveryResult, EmailMessage, TemplateKey } from "./deliver";
export * from "./templates";

function resendTransport(apiKey: string): Transport {
  const client = new Resend(apiKey);
  return {
    async send(m) {
      const { data, error } = await client.emails.send({ from: m.from, to: [m.to], subject: m.subject, html: m.html, text: m.text });
      if (error || !data) throw classifyResendError(error ?? { message: "No response from Resend" });
      return { id: data.id };
    },
  };
}

export async function sendEmail(message: EmailMessage): Promise<DeliveryResult> {
  const cfg = emailConfig();
  const db = await getDb();
  const result = await deliver(message, {
    transport: cfg.configured && cfg.apiKey ? resendTransport(cfg.apiKey) : null,
    from: cfg.from,
    notConfiguredReason: notConfiguredReason(cfg),
    fallbackVisible: cfg.fallbackVisible,
    resetFallbackVisible: cfg.resetFallbackVisible,
    async recentCount(to, template, since) {
      const [row] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(emailDeliveries)
        .where(and(eq(emailDeliveries.to, to), eq(emailDeliveries.template, template), gte(emailDeliveries.createdAt, since), ne(emailDeliveries.status, "rate_limited")));
      return Number(row?.n ?? 0);
    },
    async record(row) {
      await db.insert(emailDeliveries).values(row);
    },
  });
  if (result.status === "onscreen") console.info(`[email] ${message.template} to ${message.to} shown on screen: ${result.reason}`);
  if (result.status === "failed") console.error(`[email] ${message.template} to ${message.to} failed: ${result.reason}`);
  return result;
}

/** The spec'd shape: send(to, subject, html, text). Template defaults to a generic key for limits. */
export function send(to: string, subject: string, html: string, text: string, template: TemplateKey = "new-message") {
  return sendEmail({ to, subject, html, text, template });
}

/** Latest attempt for a recipient + template within `withinSec` (for "what happened to my code?"). */
export async function latestDelivery(to: string, template: TemplateKey, withinSec = 15 * 60) {
  const db = await getDb();
  return (
    (await db.query.emailDeliveries.findFirst({
      where: and(eq(emailDeliveries.to, to.trim().toLowerCase()), eq(emailDeliveries.template, template), gte(emailDeliveries.createdAt, new Date(Date.now() - withinSec * 1000))),
      orderBy: desc(emailDeliveries.createdAt),
    })) ?? null
  );
}
