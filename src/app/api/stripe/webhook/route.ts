import { billingDeps } from "@/server/billing/deps";
import { handleStripeWebhook } from "@/server/billing/service";
import { dbSecretStore } from "@/server/billing/store";
import { WEBHOOK_SECRET_KEY } from "@/server/billing/webhook-endpoint";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Stripe webhook. Verifies `Stripe-Signature` with the signing secret the app stored in
 * app_secrets when it registered this endpoint, then applies each event exactly once.
 */
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return Response.json({ received: false, error: "Missing Stripe-Signature header." }, { status: 400 });
  const payload = await req.text();
  const res = await handleStripeWebhook(billingDeps(), payload, signature);
  return Response.json(res.body, { status: res.status });
}

/** Non-secret health check: is Stripe configured and is the endpoint registered with Stripe? */
export async function GET() {
  const deps = billingDeps();
  let endpoint: "registered" | "missing" | "error" = "missing";
  let enabledEvents = 0;
  try {
    const raw = await dbSecretStore().get(WEBHOOK_SECRET_KEY);
    const stored = raw ? (JSON.parse(raw) as { id?: string }) : null;
    if (stored?.id && deps.stripe) {
      const ep = await deps.stripe.webhookEndpoints.retrieve(stored.id);
      endpoint = ep.status === "enabled" ? "registered" : "missing";
      enabledEvents = ep.enabled_events?.length ?? 0;
    }
  } catch {
    endpoint = "error";
  }
  return Response.json(
    { ok: true, mode: deps.stripe ? "stripe" : "demo", webhookEndpoint: endpoint, enabledEvents },
    { headers: { "cache-control": "no-store" } },
  );
}
