/**
 * Idempotent billing catalogue bootstrap. Products use fixed custom ids and prices are found by
 * lookup key, so running it any number of times (first checkout, `npm run stripe:sync`, every
 * production build) creates each object exactly once.
 *
 * No `server-only` import: `scripts/stripe-sync.ts` imports it.
 */
import {
  METER_EVENT_NAME,
  OVERAGE_LOOKUP_KEY,
  OVERAGE_PRODUCT_ID,
  PAID_PLANS,
  UNLOCK_OVERAGE_INR,
  type PlanId,
} from "@/lib/billing/plans";
import { isStripeNotFound, type StripeLike } from "./stripe";

export type Catalog = {
  /** Licensed monthly price id per paid plan. */
  prices: Partial<Record<PlanId, string>>;
  overagePriceId: string;
  meterId: string;
  /** What this run created (empty on a repeat run). */
  created: string[];
};

async function ensureProduct(stripe: StripeLike, id: string, name: string, description: string, created: string[]) {
  try {
    await stripe.products.retrieve(id);
  } catch (err) {
    if (!isStripeNotFound(err)) throw err;
    try {
      await stripe.products.create({ id, name, description, metadata: { app: "proof" } });
      created.push(`product:${id}`);
    } catch (createErr) {
      // A concurrent bootstrap won the race: the product exists now.
      await stripe.products.retrieve(id).catch(() => {
        throw createErr;
      });
    }
  }
}

async function ensurePrice(
  stripe: StripeLike,
  opts: {
    lookupKey: string;
    productId: string;
    productName: string;
    description: string;
    unitAmount: number;
    recurring: Record<string, unknown>;
    nickname: string;
  },
  created: string[],
): Promise<string> {
  const found = await stripe.prices.list({ lookup_keys: [opts.lookupKey], active: true, limit: 1 });
  if (found.data[0]) return found.data[0].id;
  await ensureProduct(stripe, opts.productId, opts.productName, opts.description, created);
  const price = await stripe.prices.create({
    product: opts.productId,
    currency: "inr",
    unit_amount: opts.unitAmount,
    recurring: opts.recurring,
    lookup_key: opts.lookupKey,
    transfer_lookup_key: true,
    nickname: opts.nickname,
    metadata: { app: "proof" },
  });
  created.push(`price:${opts.lookupKey}`);
  return price.id;
}

async function ensureMeter(stripe: StripeLike, created: string[]): Promise<string> {
  const all = await stripe.billing.meters.list({ limit: 100 });
  const match = all.data.find((m) => m.event_name === METER_EVENT_NAME);
  if (match) {
    if (match.status && match.status !== "active") await stripe.billing.meters.reactivate(match.id);
    return match.id;
  }
  const meter = await stripe.billing.meters.create({
    display_name: "Candidate unlocks",
    event_name: METER_EVENT_NAME,
    default_aggregation: { formula: "sum" },
    customer_mapping: { type: "by_id", event_payload_key: "stripe_customer_id" },
    value_settings: { event_payload_key: "value" },
  });
  created.push(`meter:${METER_EVENT_NAME}`);
  return meter.id;
}

export async function ensureCatalog(stripe: StripeLike): Promise<Catalog> {
  const created: string[] = [];
  const meterId = await ensureMeter(stripe, created);
  const prices: Catalog["prices"] = {};
  for (const plan of PAID_PLANS) {
    prices[plan.id] = await ensurePrice(
      stripe,
      {
        lookupKey: plan.lookupKey!,
        productId: plan.productId!,
        productName: `Proof ${plan.name}`,
        description: plan.blurb,
        unitAmount: plan.monthlyInr * 100,
        recurring: { interval: "month", usage_type: "licensed" },
        nickname: `${plan.name} monthly${plan.perSeat ? " per seat" : ""}`,
      },
      created,
    );
  }
  const overagePriceId = await ensurePrice(
    stripe,
    {
      lookupKey: OVERAGE_LOOKUP_KEY,
      productId: OVERAGE_PRODUCT_ID,
      productName: "Proof candidate unlocks",
      description: "Candidate unlocks beyond the plan allowance",
      unitAmount: UNLOCK_OVERAGE_INR * 100,
      recurring: { interval: "month", usage_type: "metered", meter: meterId },
      nickname: "Candidate unlock overage",
    },
    created,
  );
  return { prices, overagePriceId, meterId, created };
}

let cached: { stripe: StripeLike; promise: Promise<Catalog> } | null = null;

/** Per-process memo of `ensureCatalog` (retried on the next call after a failure). */
export function getCatalog(stripe: StripeLike): Promise<Catalog> {
  if (cached?.stripe !== stripe) {
    const promise = ensureCatalog(stripe).catch((err: unknown) => {
      cached = null;
      throw err;
    });
    cached = { stripe, promise };
  }
  return cached.promise;
}
