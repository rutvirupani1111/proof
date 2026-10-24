"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { PLANS, UNLOCK_OVERAGE_INR, formatInr, type PlanId } from "@/lib/billing/plans";
import { checkoutSchema, unlockSchema, type BillingActionResult } from "@/lib/validation/billing";
import { AuthError, assertRole } from "@/server/auth/guard";
import { getOrigin } from "@/server/public/site";
import { isMessageableStudent } from "@/server/recruiter/queries";
import { billingDeps, billingOwnerOf, ensureBillingReady } from "./deps";
import { cancelDemoPlan, completeDemoCheckout, unlockCandidate, type UsageSummary } from "./service";

const portalOf = (role: string) => (role === "college" ? "college" : "recruiter");

function fail<T>(err: unknown): BillingActionResult<T> {
  if (err instanceof AuthError) return { ok: false, error: err.message };
  console.error("[billing] action failed", err);
  return { ok: false, error: "Billing is unavailable right now. Try again in a minute.", code: "stripe_error" };
}

async function ownerContext() {
  const user = await assertRole(["recruiter", "college"]);
  return { user, owner: billingOwnerOf(user), portal: portalOf(user.role) };
}

/** Start Stripe Checkout (subscription mode, seat quantity). Demo mode returns the demo page. */
export async function startCheckoutAction(input: unknown): Promise<BillingActionResult<{ url: string; demo: boolean }>> {
  try {
    const { user, owner, portal } = await ownerContext();
    if (!owner) return { ok: false, error: "Link this account to a workspace first.", code: "no_workspace" };
    const parsed = checkoutSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the plan." };
    const plan = PLANS[parsed.data.planId];
    if (!plan.lookupKey || plan.owner !== owner.type) return { ok: false, error: "That plan is not available for this account." };
    const seats = plan.perSeat ? parsed.data.seats : 1;

    const deps = billingDeps();
    if (!deps.stripe) {
      return { ok: true, data: { url: `/${portal}/billing/demo-checkout?plan=${plan.id}&seats=${seats}`, demo: true } };
    }
    const catalog = await ensureBillingReady(deps.stripe);
    const origin = await getOrigin();
    let customer = await deps.store.getCustomer(owner);
    if (!customer) {
      const created = await deps.stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { app: "proof", owner_type: owner.type, owner_id: owner.id },
      });
      await deps.store.upsertCustomer(owner, created.id);
      customer = { stripeCustomerId: created.id, entitlements: [] };
    }
    const metadata = { owner_type: owner.type, owner_id: owner.id, plan: plan.id, replace_previous: "true" };
    const session = await deps.stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.stripeCustomerId,
      client_reference_id: `${owner.type}:${owner.id}`,
      line_items: [
        { price: catalog.prices[plan.id], quantity: seats, ...(plan.perSeat ? { adjustable_quantity: { enabled: true, minimum: 1, maximum: 200 } } : {}) },
        ...(plan.metered ? [{ price: catalog.overagePriceId }] : []),
      ],
      subscription_data: { metadata, description: `Proof ${plan.name}` },
      metadata,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      success_url: `${origin}/${portal}/billing?checkout=success&plan=${plan.id}`,
      cancel_url: `${origin}/${portal}/billing?checkout=cancelled`,
    });
    if (!session.url) throw new Error("Checkout session has no URL");
    return { ok: true, data: { url: session.url, demo: false } };
  } catch (err) {
    return fail(err);
  }
}

/** Stripe Customer Portal (invoices, card, cancel, seat changes). */
export async function openBillingPortalAction(): Promise<BillingActionResult<{ url: string }>> {
  try {
    const { owner, portal } = await ownerContext();
    if (!owner) return { ok: false, error: "Link this account to a workspace first.", code: "no_workspace" };
    const deps = billingDeps();
    if (!deps.stripe) return { ok: true, data: { url: `/${portal}/billing/demo-checkout?manage=1` } };
    const customer = await deps.store.getCustomer(owner);
    if (!customer) return { ok: false, error: "Choose a plan first; billing details appear after your first checkout." };
    const origin = await getOrigin();
    const session = await deps.stripe.billingPortal.sessions.create({ customer: customer.stripeCustomerId, return_url: `${origin}/${portal}/billing` });
    return { ok: true, data: { url: session.url } };
  } catch (err) {
    return fail(err);
  }
}

/** Demo mode only: run the simulated webhook events for a "paid" checkout. */
export async function completeDemoCheckoutAction(input: unknown): Promise<BillingActionResult<{ events: string[] }>> {
  try {
    const { owner, portal } = await ownerContext();
    if (!owner) return { ok: false, error: "Link this account to a workspace first.", code: "no_workspace" };
    const deps = billingDeps();
    if (deps.stripe) return { ok: false, error: "Stripe is configured: use the real checkout." };
    const parsed = checkoutSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Check the plan." };
    await completeDemoCheckout(deps, owner, parsed.data.planId as PlanId, parsed.data.seats);
    revalidatePath(`/${portal}`, "layout");
    return { ok: true, data: { events: ["checkout.session.completed", "customer.subscription.updated"] } };
  } catch (err) {
    return fail(err);
  }
}

export async function cancelDemoPlanAction(): Promise<BillingActionResult<null>> {
  try {
    const { owner, portal } = await ownerContext();
    if (!owner) return { ok: false, error: "Link this account to a workspace first.", code: "no_workspace" };
    const deps = billingDeps();
    if (deps.stripe) return { ok: false, error: "Stripe is configured: manage billing in the Customer Portal." };
    await cancelDemoPlan(deps, owner);
    revalidatePath(`/${portal}`, "layout");
    return { ok: true, data: null };
  } catch (err) {
    return fail(err);
  }
}

export type UnlockPayload = { email: string; usage: UsageSummary; billable: boolean; message: string };

/** Unlock a candidate's contact details and messaging (counts against the monthly allowance). */
export async function unlockCandidateAction(input: unknown): Promise<BillingActionResult<UnlockPayload>> {
  try {
    const user = await assertRole("recruiter");
    const owner = billingOwnerOf(user);
    if (!owner) return { ok: false, error: "Join a company workspace first.", code: "no_workspace" };
    const parsed = unlockSchema.safeParse(input);
    if (!parsed.success || !(await isMessageableStudent(parsed.data.studentUserId))) return { ok: false, error: "Candidate not found." };
    const res = await unlockCandidate(billingDeps(), owner, user.id, parsed.data.studentUserId);
    if (res.status === "limit") {
      return {
        ok: false,
        code: "upgrade_required",
        error: `You've used all ${res.usage.allowance} free unlocks this month. Upgrade to keep unlocking candidates.`,
      };
    }
    const db = await getDb();
    const student = await db.query.users.findFirst({ where: eq(users.id, parsed.data.studentUserId), columns: { email: true } });
    revalidatePath(`/recruiter/candidates/${parsed.data.studentUserId}`);
    return {
      ok: true,
      data: {
        email: student?.email ?? "",
        usage: res.usage,
        billable: res.billable,
        message:
          res.status === "already"
            ? "Already unlocked for your team."
            : res.billable
              ? `Unlocked. Billed ${formatInr(UNLOCK_OVERAGE_INR)} as usage beyond your plan.`
              : `Unlocked. ${Math.max(0, res.usage.allowance - res.usage.used)} unlocks left this month.`,
      },
    };
  } catch (err) {
    return fail(err);
  }
}
