import "server-only";
import { ownerTypeForRole } from "@/lib/billing/plans";
import type { SessionUser } from "@/server/auth/auth";
import { getCatalog, type Catalog } from "./catalog";
import type { BillingDeps } from "./service";
import { dbBillingStore, dbSecretStore, type BillingOwner } from "./store";
import { getStripe, type StripeLike } from "./stripe";
import { ensureWebhookEndpoint, productionWebhookUrl } from "./webhook-endpoint";

export function billingDeps(): BillingDeps {
  return { stripe: getStripe(), store: dbBillingStore(), secrets: dbSecretStore() };
}

/** The company (recruiter) or college (placement officer) that pays, from the session only. */
export function billingOwnerOf(user: SessionUser): BillingOwner | null {
  const type = ownerTypeForRole(user.role);
  if (type === "company") {
    const id = user.companyId as string | null | undefined;
    return id ? { type, id } : null;
  }
  if (type === "college") {
    const id = user.collegeId as string | null | undefined;
    return id ? { type, id } : null;
  }
  return null;
}

let ready: Promise<Catalog> | null = null;

/**
 * First use in production: catalogue plus the self-registered webhook endpoint. Memoised per
 * process; also run by `scripts/stripe-sync.ts` during the production build.
 */
export function ensureBillingReady(stripe: StripeLike): Promise<Catalog> {
  if (!ready) {
    ready = (async () => {
      const catalog = await getCatalog(stripe);
      const url = productionWebhookUrl();
      if (url) await ensureWebhookEndpoint(stripe, dbSecretStore(), url);
      return catalog;
    })().catch((err: unknown) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}
