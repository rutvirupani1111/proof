/**
 * Webhooks without manual setup. In production the app registers its own endpoint
 * (https://<VERCEL_PROJECT_PRODUCTION_URL>/api/stripe/webhook) and keeps the signing secret in
 * `app_secrets` (never env). Stripe only reveals a signing secret when an endpoint is created, so
 * an endpoint at our URL whose secret we do not hold is replaced; one we do hold is reused.
 *
 * No `server-only` import: `scripts/stripe-sync.ts` imports it.
 */
import type { SecretStore } from "./store";
import { STRIPE_API_VERSION, type StripeLike } from "./stripe";

export const WEBHOOK_SECRET_KEY = "stripe_webhook_endpoint";

export const WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "entitlements.active_entitlement_summary.updated",
] as const;

type StoredEndpoint = { id: string; url: string; secret: string };

/** The production webhook URL, derived from Vercel's system env. null off production. */
export function productionWebhookUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.VERCEL_ENV !== "production") return null;
  const host = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  return host ? `https://${host.replace(/^https?:\/\//, "").replace(/\/+$/, "")}/api/stripe/webhook` : null;
}

function parseStored(raw: string | null): StoredEndpoint | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<StoredEndpoint>;
    return v.id && v.url && v.secret ? { id: v.id, url: v.url, secret: v.secret } : null;
  } catch {
    return null;
  }
}

/** The signing secret the webhook route verifies with, or null before the bootstrap ran. */
export async function getWebhookSigningSecret(secrets: SecretStore): Promise<string | null> {
  return parseStored(await secrets.get(WEBHOOK_SECRET_KEY))?.secret ?? null;
}

export type EnsuredEndpoint = { endpointId: string; url: string; created: boolean; removed: string[] };

export async function ensureWebhookEndpoint(stripe: StripeLike, secrets: SecretStore, url: string, attempt = 0): Promise<EnsuredEndpoint> {
  let created = false;
  const removed: string[] = [];
  const raw = await secrets.getOrCreate(WEBHOOK_SECRET_KEY, async () => {
    const existing = (await stripe.webhookEndpoints.list({ limit: 100 })).data.filter((e) => e.url === url);
    // Their signing secrets are unknowable, so they cannot be verified: replace them.
    for (const e of existing) {
      await stripe.webhookEndpoints.del(e.id);
      removed.push(e.id);
    }
    const endpoint = await stripe.webhookEndpoints.create({
      url,
      enabled_events: [...WEBHOOK_EVENTS],
      api_version: STRIPE_API_VERSION,
      description: "Proof billing (created automatically by the app)",
      metadata: { app: "proof" },
    });
    if (!endpoint.secret) throw new Error("Stripe did not return a webhook signing secret.");
    created = true;
    return JSON.stringify({ id: endpoint.id, url, secret: endpoint.secret } satisfies StoredEndpoint);
  });

  const stored = parseStored(raw);
  const atUrl = (await stripe.webhookEndpoints.list({ limit: 100 })).data.filter((e) => e.url === url);
  const mine = stored ? atUrl.find((e) => e.id === stored.id) : undefined;

  if (!stored || stored.url !== url || !mine) {
    // Deleted in the dashboard, or the production domain changed: start over once.
    if (attempt > 0) throw new Error("Could not register the Stripe webhook endpoint.");
    await secrets.delete(WEBHOOK_SECRET_KEY);
    return ensureWebhookEndpoint(stripe, secrets, url, attempt + 1);
  }

  // A concurrent bootstrap may have created a twin whose secret lost the race: remove it.
  for (const e of atUrl) {
    if (e.id !== stored.id) {
      await stripe.webhookEndpoints.del(e.id);
      removed.push(e.id);
    }
  }
  const events = new Set(mine.enabled_events ?? []);
  const missing = WEBHOOK_EVENTS.some((e) => !events.has(e)) || mine.status === "disabled";
  if (missing) await stripe.webhookEndpoints.update(stored.id, { enabled_events: [...WEBHOOK_EVENTS], disabled: false });

  return { endpointId: stored.id, url, created, removed };
}
