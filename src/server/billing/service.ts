/**
 * Billing logic with its dependencies injected (Stripe client or null, store, secrets), so it is
 * unit-tested with a mocked Stripe and an in-memory store. The app wires the real ones in
 * `src/server/billing/deps.ts`.
 *
 * Plan state is written ONLY by `processStripeEvent` (from a verified webhook, or from the
 * labelled demo checkout that synthesises the same events when STRIPE_SECRET_KEY is absent).
 */
import {
  OVERAGE_LOOKUP_KEY,
  METER_EVENT_NAME,
  PLANS,
  decideUnlock,
  freePlanFor,
  isActiveStatus,
  isPlanId,
  monthStart,
  planFromLookupKey,
  unlockAllowance,
  type Plan,
  type PlanId,
  type PlanState,
  type UnlockDecision,
} from "@/lib/billing/plans";
import type { BillingOwner, BillingStore, SecretStore, SubscriptionRecord } from "./store";
import { idOf, verifyStripeEvent, type StripeEventLite, type StripeLike, type StripeSubscriptionLite } from "./stripe";
import { getWebhookSigningSecret } from "./webhook-endpoint";

export type BillingDeps = { stripe: StripeLike | null; store: BillingStore; secrets: SecretStore; now?: () => Date };

export const UNLOCK_KIND = "candidate_unlock";
const nowOf = (deps: BillingDeps) => (deps.now ? deps.now() : new Date());

/* --------------------------------- plan state -------------------------------- */

export async function getPlanState(deps: BillingDeps, owner: BillingOwner): Promise<PlanState> {
  const rows = (await deps.store.activeSubscriptions(owner)).filter((r) => isActiveStatus(r.status) && isPlanId(r.plan));
  rows.sort((a, b) => (b.stripeEventAt?.getTime() ?? 0) - (a.stripeEventAt?.getTime() ?? 0));
  const sub = rows[0];
  if (!sub) {
    return { plan: freePlanFor(owner.type), status: "free", seats: 1, currentPeriodEnd: null, cancelAtPeriodEnd: false };
  }
  return {
    plan: PLANS[sub.plan as PlanId],
    status: sub.status,
    seats: Math.max(1, sub.seats),
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
  };
}

export type UsageSummary = { used: number; allowance: number; billable: number; resetsAt: string; metered: boolean };

export async function getUsage(deps: BillingDeps, owner: BillingOwner, state?: PlanState): Promise<UsageSummary> {
  const now = nowOf(deps);
  const plan = state ?? (await getPlanState(deps, owner));
  const since = monthStart(now);
  const counts = await deps.store.countUsageSince(owner, UNLOCK_KIND, since);
  const resets = new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth() + 1, 1));
  return {
    used: counts.total,
    allowance: unlockAllowance(plan.plan, plan.seats),
    billable: counts.billable,
    resetsAt: resets.toISOString(),
    metered: plan.plan.metered,
  };
}

/* ---------------------------------- unlocks ---------------------------------- */

export type UnlockResult =
  | { status: "already" | "unlocked"; billable: boolean; reported: boolean; usage: UsageSummary }
  | { status: "limit"; decision: UnlockDecision; usage: UsageSummary };

/**
 * Unlock a candidate's contact details (and messaging) for a company. Counted once per
 * candidate; beyond the allowance a paid plan reports a meter event, a free plan is refused.
 */
export async function unlockCandidate(deps: BillingDeps, owner: BillingOwner, actorUserId: string, studentUserId: string): Promise<UnlockResult> {
  const existing = await deps.store.findUsage(owner, UNLOCK_KIND, studentUserId);
  const state = await getPlanState(deps, owner);
  if (existing) return { status: "already", billable: existing.billable, reported: !!existing.reportedAt, usage: await getUsage(deps, owner, state) };

  const before = await getUsage(deps, owner, state);
  const decision = decideUnlock(state, before.used);
  if (!decision.allowed) return { status: "limit", decision, usage: before };

  const row = await deps.store.insertUsage({
    ownerType: owner.type,
    ownerId: owner.id,
    actorUserId,
    kind: UNLOCK_KIND,
    subjectId: studentUserId,
    billable: decision.billable,
  });
  if (!row) {
    // A concurrent request unlocked the same candidate first.
    const raced = await deps.store.findUsage(owner, UNLOCK_KIND, studentUserId);
    return { status: "already", billable: raced?.billable ?? false, reported: !!raced?.reportedAt, usage: await getUsage(deps, owner, state) };
  }

  let reported = false;
  if (decision.billable) reported = await reportUnlockToMeter(deps, owner, row.id);
  return { status: "unlocked", billable: decision.billable, reported, usage: await getUsage(deps, owner, state) };
}

/** One meter event per billable unlock. The usage row id is the idempotency identifier. */
export async function reportUnlockToMeter(deps: BillingDeps, owner: BillingOwner, usageId: string): Promise<boolean> {
  const now = nowOf(deps);
  const customer = await deps.store.getCustomer(owner);
  if (!deps.stripe) {
    // Demo mode: there is no Stripe meter; mark it so the UI can show "billed (demo)".
    await deps.store.markUsageReported(usageId, now);
    return true;
  }
  if (!customer) return false;
  try {
    await deps.stripe.billing.meterEvents.create({
      event_name: METER_EVENT_NAME,
      identifier: `unlock_${usageId}`,
      timestamp: Math.floor(now.getTime() / 1000),
      payload: { stripe_customer_id: customer.stripeCustomerId, value: "1" },
    });
    await deps.store.markUsageReported(usageId, now);
    return true;
  } catch (err) {
    console.error("[billing] meter event failed; the unlock stays recorded as unreported", err);
    return false;
  }
}

/* ------------------------------- subscriptions ------------------------------- */

function ownerFromMetadata(meta: Record<string, unknown> | null | undefined): BillingOwner | null {
  const type = meta?.owner_type;
  const id = meta?.owner_id;
  if ((type === "company" || type === "college") && typeof id === "string" && id) return { type, id };
  return null;
}

/** Plan, seats and period end from a subscription's licensed item (the metered item is skipped). */
export function readSubscription(sub: StripeSubscriptionLite): { plan: Plan | null; seats: number; periodEnd: Date | null } {
  const licensed = sub.items.data.find((i) => planFromLookupKey(i.price.lookup_key));
  const plan = planFromLookupKey(licensed?.price.lookup_key) ?? (isPlanId(sub.metadata?.plan) ? PLANS[sub.metadata.plan as PlanId] : null);
  const end = licensed?.current_period_end ?? sub.current_period_end ?? null;
  return { plan: plan?.lookupKey ? plan : null, seats: Math.max(1, licensed?.quantity ?? 1), periodEnd: end ? new Date(end * 1000) : null };
}

async function applySubscription(
  deps: BillingDeps,
  sub: StripeSubscriptionLite,
  eventAt: Date,
  opts: { ownerHint?: BillingOwner | null; replaceOthers?: boolean } = {},
): Promise<SubscriptionRecord | null> {
  const customerId = idOf(sub.customer);
  if (!customerId) return null;
  const owner = opts.ownerHint ?? ownerFromMetadata(sub.metadata) ?? (await deps.store.getOwnerByCustomer(customerId));
  const { plan, seats, periodEnd } = readSubscription(sub);
  if (!owner || !plan) {
    console.warn(`[billing] subscription ${sub.id} has no known owner or plan; ignored`);
    return null;
  }
  const existing = await deps.store.getSubscription(sub.id);
  if (existing?.stripeEventAt && existing.stripeEventAt.getTime() > eventAt.getTime()) return existing; // older delivery

  await deps.store.upsertCustomer(owner, customerId);
  const row: SubscriptionRecord = {
    ownerType: owner.type,
    ownerId: owner.id,
    stripeSubscriptionId: sub.id,
    stripeCustomerId: customerId,
    plan: plan.id,
    status: sub.status,
    seats,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    stripeEventAt: eventAt,
  };
  await deps.store.saveSubscription(row);

  // Upgrade / downgrade happens through a new Checkout: retire the previous subscription.
  if (opts.replaceOthers && isActiveStatus(sub.status)) {
    for (const other of await deps.store.activeSubscriptions(owner)) {
      if (other.stripeSubscriptionId === sub.id) continue;
      if (deps.stripe && !other.stripeSubscriptionId.startsWith("demo_")) {
        await deps.stripe.subscriptions.cancel(other.stripeSubscriptionId, { prorate: true });
      } else {
        await deps.store.saveSubscription({ ...other, status: "canceled", stripeEventAt: eventAt });
      }
    }
  }
  return row;
}

/* ---------------------------------- webhooks --------------------------------- */

export type EventOutcome = "applied" | "ignored" | "duplicate";

/** Apply one (already verified) Stripe event exactly once. */
export async function processStripeEvent(deps: BillingDeps, event: StripeEventLite): Promise<EventOutcome> {
  if (!(await deps.store.claimEvent(event.id, event.type))) return "duplicate";
  try {
    return await applyEvent(deps, event);
  } catch (err) {
    // Let Stripe retry: forget the claim so the redelivery is processed.
    await deps.store.releaseEvent(event.id);
    throw err;
  }
}

async function applyEvent(deps: BillingDeps, event: StripeEventLite): Promise<EventOutcome> {
  const obj = event.data.object;
  const at = new Date(event.created * 1000);
  switch (event.type) {
    case "checkout.session.completed": {
      if (obj.mode !== "subscription") return "ignored";
      const owner = ownerFromMetadata(obj.metadata as Record<string, unknown>);
      const customerId = idOf(obj.customer as string | { id: string } | null);
      if (owner && customerId) await deps.store.upsertCustomer(owner, customerId);
      const subId = idOf(obj.subscription as string | { id: string } | null);
      if (!subId || !deps.stripe) return owner ? "applied" : "ignored";
      const sub = await deps.stripe.subscriptions.retrieve(subId);
      return (await applySubscription(deps, sub, at, { ownerHint: owner, replaceOthers: true })) ? "applied" : "ignored";
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = obj as unknown as StripeSubscriptionLite;
      const replaceOthers = event.type !== "customer.subscription.deleted" && sub.metadata?.replace_previous === "true";
      return (await applySubscription(deps, sub, at, { replaceOthers })) ? "applied" : "ignored";
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      const parent = obj.parent as { subscription_details?: { subscription?: string | { id: string } } } | null | undefined;
      const subId = idOf(parent?.subscription_details?.subscription ?? (obj.subscription as string | { id: string } | null | undefined));
      if (!subId || !deps.stripe) return "ignored";
      const sub = await deps.stripe.subscriptions.retrieve(subId);
      return (await applySubscription(deps, sub, at)) ? "applied" : "ignored";
    }
    case "entitlements.active_entitlement_summary.updated": {
      const customerId = idOf(obj.customer as string | { id: string } | null);
      const list = (obj.entitlements as { data?: { lookup_key?: string }[] } | undefined)?.data ?? [];
      if (!customerId) return "ignored";
      await deps.store.setEntitlements(customerId, list.map((e) => e.lookup_key).filter((k): k is string => !!k));
      return "applied";
    }
    default:
      return "ignored";
  }
}

export type WebhookResponse = { status: number; body: { received: boolean; outcome?: EventOutcome; error?: string } };

/** The whole webhook: signature check against the stored secret, then idempotent apply. */
export async function handleStripeWebhook(deps: BillingDeps, payload: string, signature: string | null): Promise<WebhookResponse> {
  if (!signature) return { status: 400, body: { received: false, error: "Missing Stripe-Signature header." } };
  const secret = await getWebhookSigningSecret(deps.secrets);
  if (!secret) return { status: 400, body: { received: false, error: "Webhook endpoint is not registered yet." } };
  let event: StripeEventLite;
  try {
    event = await verifyStripeEvent(payload, signature, secret);
  } catch {
    return { status: 400, body: { received: false, error: "Invalid signature." } };
  }
  try {
    const outcome = await processStripeEvent(deps, event);
    return { status: 200, body: { received: true, outcome } };
  } catch (err) {
    console.error(`[billing] failed to apply ${event.type} ${event.id}`, err);
    return { status: 500, body: { received: false, error: "Could not apply the event; Stripe will retry." } };
  }
}

/* ------------------------------- demo checkout ------------------------------- */

const demoEventId = () => `demo_evt_${crypto.randomUUID().replace(/-/g, "")}`;

/**
 * Without STRIPE_SECRET_KEY: simulate what Stripe would send after a successful Checkout, through
 * the same `processStripeEvent` path the real webhook uses. Clearly labelled in the UI.
 */
export async function completeDemoCheckout(deps: BillingDeps, owner: BillingOwner, planId: PlanId, seats: number): Promise<EventOutcome[]> {
  const plan = PLANS[planId];
  if (!plan.lookupKey || plan.owner !== owner.type) throw new Error("That plan is not available for this account.");
  const now = nowOf(deps);
  const created = Math.floor(now.getTime() / 1000);
  const periodEnd = created + 30 * 24 * 3600;
  const sub: StripeSubscriptionLite = {
    id: `demo_sub_${owner.type}_${owner.id}`,
    customer: `demo_cus_${owner.type}_${owner.id}`,
    status: "active",
    cancel_at_period_end: false,
    metadata: { owner_type: owner.type, owner_id: owner.id, plan: plan.id },
    items: {
      data: [
        { price: { id: `demo_price_${plan.id}`, lookup_key: plan.lookupKey }, quantity: plan.perSeat ? Math.max(1, seats) : 1, current_period_end: periodEnd },
        ...(plan.metered ? [{ price: { id: "demo_price_overage", lookup_key: OVERAGE_LOOKUP_KEY }, current_period_end: periodEnd }] : []),
      ],
    },
  };
  return [
    await processStripeEvent(deps, {
      id: demoEventId(),
      type: "checkout.session.completed",
      created,
      data: { object: { mode: "subscription", customer: sub.customer, subscription: sub.id, metadata: sub.metadata } },
    }),
    await processStripeEvent(deps, { id: demoEventId(), type: "customer.subscription.updated", created, data: { object: sub as never } }),
  ];
}

export async function cancelDemoPlan(deps: BillingDeps, owner: BillingOwner): Promise<void> {
  const [active] = await deps.store.activeSubscriptions(owner);
  if (!active || !active.stripeSubscriptionId.startsWith("demo_")) return;
  const plan = PLANS[active.plan as PlanId];
  await processStripeEvent(deps, {
    id: demoEventId(),
    type: "customer.subscription.deleted",
    created: Math.floor(nowOf(deps).getTime() / 1000),
    data: {
      object: {
        id: active.stripeSubscriptionId,
        customer: active.stripeCustomerId,
        status: "canceled",
        metadata: { owner_type: owner.type, owner_id: owner.id, plan: active.plan },
        items: { data: [{ price: { id: `demo_price_${active.plan}`, lookup_key: plan?.lookupKey ?? null }, quantity: active.seats }] },
      },
    },
  });
}
