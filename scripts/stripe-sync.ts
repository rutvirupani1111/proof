/**
 * `npm run stripe:sync`: create or find the Stripe catalogue (products, prices by lookup key, the
 * candidate_unlocks meter) and, on a Vercel production build, register the webhook endpoint and
 * store its signing secret in app_secrets. Idempotent; prints ids only, never secrets.
 *
 * Runs in `vercel-build` after migrations. It never fails the build: billing also bootstraps
 * itself on first use.
 */
import { closeDb } from "../src/db";
import { ensureCatalog } from "../src/server/billing/catalog";
import { dbSecretStore } from "../src/server/billing/store";
import { getStripe } from "../src/server/billing/stripe";
import { ensureWebhookEndpoint, productionWebhookUrl } from "../src/server/billing/webhook-endpoint";

const fromBuild = process.argv.includes("--build");

async function main() {
  if (fromBuild && process.env.VERCEL && process.env.VERCEL_ENV !== "production") {
    console.log(`[stripe-sync] VERCEL_ENV=${process.env.VERCEL_ENV ?? "unknown"}: skipped (production only).`);
    return;
  }
  const stripe = getStripe();
  if (!stripe) {
    console.log("[stripe-sync] STRIPE_SECRET_KEY is not set: billing runs in demo mode. Nothing to sync.");
    return;
  }
  const catalog = await ensureCatalog(stripe);
  console.log(`[stripe-sync] Catalogue ready (${catalog.created.length ? `created ${catalog.created.join(", ")}` : "nothing new"}).`);
  for (const [plan, price] of Object.entries(catalog.prices)) console.log(`  ${plan}: ${price}`);
  console.log(`  overage: ${catalog.overagePriceId} (meter ${catalog.meterId})`);

  const url = productionWebhookUrl();
  if (!url) {
    console.log("[stripe-sync] Not a Vercel production environment: webhook endpoint not registered.");
    return;
  }
  if (!process.env.DATABASE_URL) {
    console.log("[stripe-sync] No DATABASE_URL: cannot store the webhook signing secret; skipped.");
    return;
  }
  const ep = await ensureWebhookEndpoint(stripe, dbSecretStore(), url);
  console.log(`[stripe-sync] Webhook endpoint ${ep.endpointId} ${ep.created ? "created" : "reused"} for ${ep.url}${ep.removed.length ? ` (replaced ${ep.removed.length})` : ""}.`);
}

main()
  .catch((err: unknown) => {
    console.error("[stripe-sync] failed:", err instanceof Error ? err.message : err);
    if (!fromBuild) process.exitCode = 1;
  })
  .finally(() => closeDb().catch(() => undefined));
