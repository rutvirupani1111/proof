import { describe, expect, it, vi } from "vitest";
import { METER_EVENT_NAME, OVERAGE_LOOKUP_KEY, PLANS, canExportStats, decideUnlock, type PlanState } from "@/lib/billing/plans";
import { ensureCatalog } from "./catalog";
import { getPlanState, handleStripeWebhook, unlockCandidate, type BillingDeps } from "./service";
import type { BillingOwner, BillingStore, SecretStore, SubscriptionRecord, UsageRecord } from "./store";
import { signTestPayload, type StripeLike, type StripeSubscriptionLite, type StripeWebhookEndpointLite } from "./stripe";
import { WEBHOOK_EVENTS, WEBHOOK_SECRET_KEY, ensureWebhookEndpoint, productionWebhookUrl } from "./webhook-endpoint";

/* ----------------------------- in-memory fakes ----------------------------- */

function memorySecrets(): SecretStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    get: async (k) => map.get(k) ?? null,
    getOrCreate: async (k, gen) => {
      if (!map.has(k)) map.set(k, await gen());
      return map.get(k)!;
    },
    delete: async (k) => void map.delete(k),
  };
}

function memoryStore(): BillingStore & { subs: Map<string, SubscriptionRecord>; usage: UsageRecord[]; events: Set<string> } {
  const customers = new Map<string, { owner: BillingOwner; entitlements: string[] }>();
  const subs = new Map<string, SubscriptionRecord>();
  const usage: UsageRecord[] = [];
  const events = new Set<string>();
  const sameOwner = (o: BillingOwner, t: string, id: string) => o.type === t && o.id === id;
  return {
    subs,
    usage,
    events,
    async getCustomer(owner) {
      for (const [id, c] of customers) if (sameOwner(owner, c.owner.type, c.owner.id)) return { stripeCustomerId: id, entitlements: c.entitlements };
      return null;
    },
    getOwnerByCustomer: async (id) => customers.get(id)?.owner ?? null,
    async upsertCustomer(owner, id) {
      for (const [k, c] of customers) if (sameOwner(owner, c.owner.type, c.owner.id)) customers.delete(k);
      customers.set(id, { owner, entitlements: [] });
    },
    async setEntitlements(id, keys) {
      const c = customers.get(id);
      if (c) c.entitlements = keys;
    },
    getSubscription: async (id) => subs.get(id) ?? null,
    saveSubscription: async (row) => void subs.set(row.stripeSubscriptionId, { ...row }),
    activeSubscriptions: async (owner) =>
      [...subs.values()].filter((s) => sameOwner(owner, s.ownerType, s.ownerId) && ["active", "trialing", "past_due"].includes(s.status)),
    async claimEvent(id) {
      if (events.has(id)) return false;
      events.add(id);
      return true;
    },
    releaseEvent: async (id) => void events.delete(id),
    findUsage: async (owner, kind, subject) => usage.find((u) => sameOwner(owner, u.ownerType, u.ownerId) && u.kind === kind && u.subjectId === subject) ?? null,
    async countUsageSince(owner, kind, since) {
      const rows = usage.filter((u) => sameOwner(owner, u.ownerType, u.ownerId) && u.kind === kind && u.createdAt >= since);
      return { total: rows.length, billable: rows.filter((r) => r.billable).length };
    },
    async insertUsage(row) {
      if (usage.some((u) => sameOwner({ type: row.ownerType, id: row.ownerId }, u.ownerType, u.ownerId) && u.kind === row.kind && u.subjectId === row.subjectId)) return null;
      const rec: UsageRecord = { ...row, id: `use_${usage.length + 1}`, createdAt: new Date(), reportedAt: null };
      usage.push(rec);
      return rec;
    },
    async markUsageReported(id, at) {
      const u = usage.find((x) => x.id === id);
      if (u) u.reportedAt = at;
    },
  };
}

/** A Stripe mock backed by in-memory objects, so idempotency is observable. */
function mockStripe() {
  const products = new Map<string, { id: string }>();
  const prices: { id: string; lookup_key: string; active: boolean }[] = [];
  const meters: { id: string; event_name: string; status: string }[] = [];
  const endpoints: StripeWebhookEndpointLite[] = [];
  const subscriptions = new Map<string, StripeSubscriptionLite>();
  let n = 0;
  const notFound = () => Object.assign(new Error("No such object"), { statusCode: 404, code: "resource_missing" });
  const stripe = {
    products: {
      retrieve: vi.fn(async (id: string) => {
        const p = products.get(id);
        if (!p) throw notFound();
        return p;
      }),
      create: vi.fn(async (p: Record<string, unknown>) => {
        const prod = { id: String(p.id) };
        products.set(prod.id, prod);
        return prod;
      }),
    },
    prices: {
      list: vi.fn(async (p: Record<string, unknown>) => ({
        data: prices.filter((x) => x.active && (p.lookup_keys as string[]).includes(x.lookup_key)),
      })),
      create: vi.fn(async (p: Record<string, unknown>) => {
        const price = { id: `price_${++n}`, lookup_key: String(p.lookup_key), active: true };
        prices.push(price);
        return price;
      }),
    },
    billing: {
      meters: {
        list: vi.fn(async () => ({ data: meters })),
        create: vi.fn(async (p: Record<string, unknown>) => {
          const m = { id: `mtr_${++n}`, event_name: String(p.event_name), status: "active" };
          meters.push(m);
          return m;
        }),
        reactivate: vi.fn(async (id: string) => ({ id })),
      },
      meterEvents: { create: vi.fn(async () => ({})) },
    },
    webhookEndpoints: {
      list: vi.fn(async () => ({ data: [...endpoints] })),
      create: vi.fn(async (p: Record<string, unknown>) => {
        const ep = { id: `we_${++n}`, url: String(p.url), status: "enabled", enabled_events: p.enabled_events as string[], secret: `whsec_test_${n}` };
        endpoints.push({ ...ep, secret: null });
        return ep;
      }),
      retrieve: vi.fn(async (id: string) => endpoints.find((e) => e.id === id)!),
      update: vi.fn(async (id: string) => endpoints.find((e) => e.id === id)!),
      del: vi.fn(async (id: string) => {
        const i = endpoints.findIndex((e) => e.id === id);
        if (i >= 0) endpoints.splice(i, 1);
        return { id, deleted: true };
      }),
    },
    customers: { create: vi.fn(async () => ({ id: `cus_${++n}` })) },
    checkout: { sessions: { create: vi.fn(async () => ({ id: "cs_1", url: "https://checkout.stripe.test/cs_1" })) } },
    billingPortal: { sessions: { create: vi.fn(async () => ({ url: "https://billing.stripe.test/p" })) } },
    subscriptions: {
      retrieve: vi.fn(async (id: string) => subscriptions.get(id)!),
      cancel: vi.fn(async () => ({})),
    },
  };
  return { stripe: stripe as unknown as StripeLike & typeof stripe, endpoints, subscriptions, prices };
}

const company: BillingOwner = { type: "company", id: "co_1" };
const college: BillingOwner = { type: "college", id: "col_1" };

function subscription(id: string, planLookup: string, seats: number, status = "active"): StripeSubscriptionLite {
  return {
    id,
    customer: "cus_live",
    status,
    metadata: { owner_type: "company", owner_id: company.id },
    items: {
      data: [
        { price: { id: "price_plan", lookup_key: planLookup }, quantity: seats, current_period_end: 1_900_000_000 },
        { price: { id: "price_over", lookup_key: OVERAGE_LOOKUP_KEY }, current_period_end: 1_900_000_000 },
      ],
    },
  };
}

/* ---------------------------------- tests ---------------------------------- */

describe("catalogue bootstrap", () => {
  it("creates products, prices and the meter once, then reuses them", async () => {
    const { stripe } = mockStripe();
    const first = await ensureCatalog(stripe);
    expect(stripe.prices.create).toHaveBeenCalledTimes(4);
    expect(stripe.billing.meters.create).toHaveBeenCalledTimes(1);
    expect(stripe.billing.meters.create.mock.calls[0]?.[0]).toMatchObject({ event_name: METER_EVENT_NAME });
    const starter = stripe.prices.create.mock.calls.find((c) => (c[0] as { lookup_key: string }).lookup_key === PLANS.recruiter_starter.lookupKey)?.[0];
    expect(starter).toMatchObject({ currency: "inr", unit_amount: 299_900, recurring: { interval: "month", usage_type: "licensed" } });
    const overage = stripe.prices.create.mock.calls.find((c) => (c[0] as { lookup_key: string }).lookup_key === OVERAGE_LOOKUP_KEY)?.[0];
    expect(overage).toMatchObject({ unit_amount: 4_900, recurring: { usage_type: "metered", meter: first.meterId } });

    const second = await ensureCatalog(stripe);
    expect(stripe.prices.create).toHaveBeenCalledTimes(4);
    expect(stripe.products.create).toHaveBeenCalledTimes(4);
    expect(stripe.billing.meters.create).toHaveBeenCalledTimes(1);
    expect(second.created).toEqual([]);
    expect(second.prices).toEqual(first.prices);
  });
});

describe("webhook endpoint bootstrap", () => {
  const url = "https://proof-pink-eta.vercel.app/api/stripe/webhook";

  it("derives the URL from VERCEL_PROJECT_PRODUCTION_URL on production only", () => {
    expect(productionWebhookUrl({ VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "proof-pink-eta.vercel.app" } as unknown as NodeJS.ProcessEnv)).toBe(url);
    expect(productionWebhookUrl({ VERCEL_ENV: "preview", VERCEL_PROJECT_PRODUCTION_URL: "proof-pink-eta.vercel.app" } as unknown as NodeJS.ProcessEnv)).toBeNull();
  });

  it("creates the endpoint once, stores its secret, and reuses it", async () => {
    const { stripe, endpoints } = mockStripe();
    const secrets = memorySecrets();
    const a = await ensureWebhookEndpoint(stripe, secrets, url);
    const b = await ensureWebhookEndpoint(stripe, secrets, url);
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    expect(b.endpointId).toBe(a.endpointId);
    expect(stripe.webhookEndpoints.create).toHaveBeenCalledTimes(1);
    expect(stripe.webhookEndpoints.create.mock.calls[0]?.[0]).toMatchObject({ url, enabled_events: [...WEBHOOK_EVENTS] });
    expect(endpoints).toHaveLength(1);
    expect(JSON.parse(secrets.map.get(WEBHOOK_SECRET_KEY)!)).toMatchObject({ id: a.endpointId, secret: expect.stringMatching(/^whsec_/) });
  });

  it("replaces an endpoint at our URL whose signing secret we never stored", async () => {
    const { stripe, endpoints } = mockStripe();
    endpoints.push({ id: "we_orphan", url, status: "enabled", enabled_events: [] });
    const res = await ensureWebhookEndpoint(stripe, memorySecrets(), url);
    expect(res.removed).toContain("we_orphan");
    expect(endpoints.map((e) => e.id)).toEqual([res.endpointId]);
  });
});

describe("webhook handler", () => {
  async function setup() {
    const { stripe, subscriptions } = mockStripe();
    const store = memoryStore();
    const secrets = memorySecrets();
    secrets.map.set(WEBHOOK_SECRET_KEY, JSON.stringify({ id: "we_1", url: "https://x/api/stripe/webhook", secret: "whsec_unit" }));
    const deps: BillingDeps = { stripe, store, secrets };
    return { deps, store, stripe, subscriptions };
  }
  const eventPayload = (id: string, type: string, object: unknown, created = 1_800_000_000) => JSON.stringify({ id, type, created, data: { object } });

  it("rejects a missing or invalid signature", async () => {
    const { deps, store } = await setup();
    const payload = eventPayload("evt_1", "customer.subscription.created", subscription("sub_1", PLANS.recruiter_growth.lookupKey!, 3));
    expect((await handleStripeWebhook(deps, payload, null)).status).toBe(400);
    expect((await handleStripeWebhook(deps, payload, signTestPayload(payload, "whsec_wrong"))).status).toBe(400);
    expect((await handleStripeWebhook(deps, payload + " ", signTestPayload(payload, "whsec_unit"))).status).toBe(400);
    expect(store.subs.size).toBe(0);
  });

  it("applies a verified event once and acknowledges duplicates", async () => {
    const { deps, store } = await setup();
    const payload = eventPayload("evt_2", "customer.subscription.created", subscription("sub_2", PLANS.recruiter_growth.lookupKey!, 3));
    const sig = signTestPayload(payload, "whsec_unit");
    const first = await handleStripeWebhook(deps, payload, sig);
    expect(first).toEqual({ status: 200, body: { received: true, outcome: "applied" } });
    const state = await getPlanState(deps, company);
    expect(state.plan.id).toBe("recruiter_growth");
    expect(state.seats).toBe(3);

    const saveSpy = vi.spyOn(store, "saveSubscription");
    const again = await handleStripeWebhook(deps, payload, signTestPayload(payload, "whsec_unit"));
    expect(again.body.outcome).toBe("duplicate");
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it("never lets an older delivery overwrite newer state, and cancels on deletion", async () => {
    const { deps } = await setup();
    const send = (id: string, type: string, sub: StripeSubscriptionLite, created: number) => {
      const p = eventPayload(id, type, sub, created);
      return handleStripeWebhook(deps, p, signTestPayload(p, "whsec_unit"));
    };
    await send("evt_a", "customer.subscription.updated", subscription("sub_3", PLANS.recruiter_growth.lookupKey!, 5), 2_000);
    await send("evt_b", "customer.subscription.updated", subscription("sub_3", PLANS.recruiter_starter.lookupKey!, 1), 1_000);
    expect((await getPlanState(deps, company)).plan.id).toBe("recruiter_growth");
    await send("evt_c", "customer.subscription.deleted", subscription("sub_3", PLANS.recruiter_growth.lookupKey!, 5, "canceled"), 3_000);
    expect((await getPlanState(deps, company)).plan.id).toBe("recruiter_free");
  });

  it("checkout.session.completed retrieves the subscription and retires the previous plan", async () => {
    const { deps, stripe, subscriptions } = await setup();
    const old = subscription("sub_old", PLANS.recruiter_starter.lookupKey!, 1);
    const p0 = eventPayload("evt_o", "customer.subscription.created", old, 1_000);
    await handleStripeWebhook(deps, p0, signTestPayload(p0, "whsec_unit"));
    subscriptions.set("sub_new", subscription("sub_new", PLANS.recruiter_growth.lookupKey!, 2));
    const p = eventPayload("evt_cs", "checkout.session.completed", { mode: "subscription", customer: "cus_live", subscription: "sub_new", metadata: { owner_type: "company", owner_id: company.id } }, 2_000);
    const res = await handleStripeWebhook(deps, p, signTestPayload(p, "whsec_unit"));
    expect(res.body.outcome).toBe("applied");
    expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_new");
    expect(stripe.subscriptions.cancel).toHaveBeenCalledWith("sub_old", { prorate: true });
  });
});

describe("plan gating", () => {
  const state = (planId: keyof typeof PLANS, seats = 1): PlanState => ({ plan: PLANS[planId], status: "active", seats, currentPeriodEnd: null, cancelAtPeriodEnd: false });

  it("free recruiters get 5 unlocks a month, then must upgrade", () => {
    expect(decideUnlock(state("recruiter_free"), 4)).toMatchObject({ allowed: true, billable: false });
    expect(decideUnlock(state("recruiter_free"), 5)).toMatchObject({ allowed: false, reason: "limit", allowance: 5 });
  });

  it("paid plans scale the allowance by seats and bill beyond it", () => {
    expect(decideUnlock(state("recruiter_starter", 2), 79)).toMatchObject({ allowed: true, billable: false, allowance: 80 });
    expect(decideUnlock(state("recruiter_starter", 2), 80)).toMatchObject({ allowed: true, billable: true });
  });

  it("stats export needs College Campus", () => {
    expect(canExportStats(state("college_free"))).toBe(false);
    expect(canExportStats(state("college_campus"))).toBe(true);
  });
});

describe("meter reporting", () => {
  it("reports one meter event per unlock beyond the allowance, never for repeats", async () => {
    const { stripe } = mockStripe();
    const store = memoryStore();
    const deps: BillingDeps = { stripe, store, secrets: memorySecrets() };
    await store.upsertCustomer(company, "cus_live");
    await store.saveSubscription({
      ownerType: "company",
      ownerId: company.id,
      stripeSubscriptionId: "sub_m",
      stripeCustomerId: "cus_live",
      plan: "recruiter_starter",
      status: "active",
      seats: 1,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      stripeEventAt: new Date(),
    });
    for (let i = 0; i < 40; i++) await unlockCandidate(deps, company, "u_rec", `stu_${i}`);
    expect(stripe.billing.meterEvents.create).not.toHaveBeenCalled();

    const over = await unlockCandidate(deps, company, "u_rec", "stu_40");
    expect(over).toMatchObject({ status: "unlocked", billable: true, reported: true });
    expect(stripe.billing.meterEvents.create).toHaveBeenCalledTimes(1);
    expect((stripe.billing.meterEvents.create.mock.calls as unknown as unknown[][])[0]?.[0]).toMatchObject({
      event_name: METER_EVENT_NAME,
      payload: { stripe_customer_id: "cus_live", value: "1" },
      identifier: expect.stringMatching(/^unlock_/),
    });

    expect((await unlockCandidate(deps, company, "u_rec", "stu_40")).status).toBe("already");
    expect(stripe.billing.meterEvents.create).toHaveBeenCalledTimes(1);
  });

  it("blocks the sixth unlock on the free plan without reporting usage", async () => {
    const { stripe } = mockStripe();
    const deps: BillingDeps = { stripe, store: memoryStore(), secrets: memorySecrets() };
    for (let i = 0; i < 5; i++) expect((await unlockCandidate(deps, company, "u", `s${i}`)).status).toBe("unlocked");
    expect((await unlockCandidate(deps, company, "u", "s5")).status).toBe("limit");
    expect(stripe.billing.meterEvents.create).not.toHaveBeenCalled();
    expect((await getPlanState(deps, college)).plan.id).toBe("college_free");
  });
});
