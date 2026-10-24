/**
 * The Stripe client, narrowed to the calls Proof makes so tests can pass a plain mock.
 * `getStripe()` returns null without STRIPE_SECRET_KEY: the app then runs the labelled demo
 * checkout instead (see src/server/billing/service.ts `completeDemoCheckout`).
 *
 * No `server-only` import: `scripts/stripe-sync.ts` imports it. Never import from client code.
 */
import Stripe from "stripe";

/** The SDK's pinned (latest) API version; webhook endpoints are created on the same version. */
export const STRIPE_API_VERSION: string = Stripe.API_VERSION;

type List<T> = Promise<{ data: T[] }>;
type Params = Record<string, unknown>;

export type StripePriceLite = {
  id: string;
  lookup_key?: string | null;
  product?: string | { id: string };
  recurring?: { usage_type?: string | null; meter?: string | null } | null;
};

export type StripeSubscriptionLite = {
  id: string;
  customer: string | { id: string };
  status: string;
  cancel_at_period_end?: boolean | null;
  current_period_end?: number | null;
  metadata?: Record<string, string> | null;
  items: { data: { price: StripePriceLite; quantity?: number | null; current_period_end?: number | null }[] };
};

export type StripeWebhookEndpointLite = {
  id: string;
  url: string;
  status?: string;
  enabled_events?: string[];
  secret?: string | null;
};

export interface StripeLike {
  products: { retrieve(id: string): Promise<{ id: string }>; create(p: Params): Promise<{ id: string }> };
  prices: { list(p: Params): List<StripePriceLite>; create(p: Params): Promise<StripePriceLite> };
  billing: {
    meters: {
      list(p: Params): List<{ id: string; event_name: string; status?: string }>;
      create(p: Params): Promise<{ id: string; event_name: string }>;
      reactivate(id: string): Promise<{ id: string }>;
    };
    meterEvents: {
      create(p: { event_name: string; payload: Record<string, string>; identifier?: string; timestamp?: number }): Promise<unknown>;
    };
  };
  webhookEndpoints: {
    list(p: Params): List<StripeWebhookEndpointLite>;
    create(p: Params): Promise<StripeWebhookEndpointLite>;
    retrieve(id: string): Promise<StripeWebhookEndpointLite>;
    update(id: string, p: Params): Promise<StripeWebhookEndpointLite>;
    del(id: string): Promise<unknown>;
  };
  customers: { create(p: Params): Promise<{ id: string }> };
  checkout: { sessions: { create(p: Params): Promise<{ id: string; url: string | null }> } };
  billingPortal: { sessions: { create(p: Params): Promise<{ url: string }> } };
  subscriptions: {
    retrieve(id: string): Promise<StripeSubscriptionLite>;
    cancel(id: string, p?: Params): Promise<unknown>;
  };
}

/** A minimal Stripe event (what the webhook handler reads). */
export type StripeEventLite = { id: string; type: string; created: number; data: { object: Record<string, unknown> } };

const globalForStripe = globalThis as unknown as { __proofStripe?: { key: string; client: StripeLike } };

export function stripeConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return !!env.STRIPE_SECRET_KEY?.trim();
}

export function getStripe(): StripeLike | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  if (globalForStripe.__proofStripe?.key !== key) {
    const client = new Stripe(key, {
      apiVersion: STRIPE_API_VERSION as never,
      appInfo: { name: "Proof", url: "https://proof-pink-eta.vercel.app" },
      maxNetworkRetries: 2,
    });
    globalForStripe.__proofStripe = { key, client: client as unknown as StripeLike };
  }
  return globalForStripe.__proofStripe!.client;
}

/** Verify a webhook signature with the stored signing secret (no API key needed). */
export async function verifyStripeEvent(payload: string, signature: string, secret: string): Promise<StripeEventLite> {
  const event = await Stripe.webhooks.constructEventAsync(payload, signature, secret);
  return event as unknown as StripeEventLite;
}

/** Test helper: a valid `Stripe-Signature` header for a payload. */
export function signTestPayload(payload: string, secret: string): string {
  return Stripe.webhooks.generateTestHeaderString({ payload, secret });
}

export const isStripeNotFound = (err: unknown) =>
  typeof err === "object" &&
  err !== null &&
  ((err as { statusCode?: number }).statusCode === 404 || (err as { code?: string }).code === "resource_missing");

export const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : (v?.id ?? null));
