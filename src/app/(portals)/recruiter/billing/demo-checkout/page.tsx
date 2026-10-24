import type { Metadata } from "next";
import { DemoCheckout } from "@/components/billing/demo-checkout";
import { PLANS, isPlanId } from "@/lib/billing/plans";
import { requireRole } from "@/server/auth/guard";
import { billingOwnerOf } from "@/server/billing/deps";
import { getBillingOverview } from "@/server/billing/queries";
import { getStripe } from "@/server/billing/stripe";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Demo checkout" };
export const dynamic = "force-dynamic";

/** Shown only when STRIPE_SECRET_KEY is absent: a labelled stand-in for Stripe Checkout. */
export default async function DemoCheckoutPage({ searchParams }: { searchParams: Promise<{ plan?: string; seats?: string; manage?: string }> }) {
  const user = await requireRole("recruiter", "/recruiter/billing");
  const owner = billingOwnerOf(user);
  if (!owner || getStripe()) redirect("/recruiter/billing");
  const sp = await searchParams;
  const o = await getBillingOverview(owner);
  const planId = isPlanId(sp.plan) && PLANS[sp.plan].owner === owner.type && PLANS[sp.plan].lookupKey ? sp.plan : null;
  const seats = Math.min(200, Math.max(1, Number.parseInt(sp.seats ?? "1", 10) || 1));
  return (
    <DemoCheckout
      portal="recruiter"
      planId={sp.manage ? null : planId}
      seats={seats}
      currentPlanId={o.state.plan.id}
      currentSeats={o.state.seats}
      email={user.email}
    />
  );
}
