import type { Metadata } from "next";
import { BillingView } from "@/components/billing/billing-view";
import { PageHeader } from "@/components/ui/page-header";
import { isPlanId } from "@/lib/billing/plans";
import { requireRole } from "@/server/auth/guard";
import { billingOwnerOf } from "@/server/billing/deps";
import { getBillingOverview } from "@/server/billing/queries";
import { NoWorkspace } from "../_components/no-workspace";

export const metadata: Metadata = { title: "Billing" };
export const dynamic = "force-dynamic";

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string; plan?: string }> }) {
  const user = await requireRole("recruiter", "/recruiter/billing");
  const owner = billingOwnerOf(user);
  const header = <PageHeader eyebrow="Company" title="Billing" description="Your plan, seats and candidate unlocks. Plan changes are confirmed by Stripe." />;
  if (!owner) {
    return (
      <>
        {header}
        <NoWorkspace />
      </>
    );
  }
  const sp = await searchParams;
  const o = await getBillingOverview(owner);
  return (
    <>
      {header}
      <BillingView
        owner={owner.type}
        mode={o.mode}
        planId={o.state.plan.id}
        status={o.state.status}
        seats={o.state.seats}
        currentPeriodEnd={o.state.currentPeriodEnd}
        cancelAtPeriodEnd={o.state.cancelAtPeriodEnd}
        usage={o.usage}
        checkout={sp.checkout === "success" || sp.checkout === "cancelled" ? sp.checkout : null}
        expectedPlan={isPlanId(sp.plan) ? sp.plan : null}
      />
    </>
  );
}
