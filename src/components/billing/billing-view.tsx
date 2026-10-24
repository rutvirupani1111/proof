"use client";

import { CalendarClock, Check, CreditCard, FlaskConical, Loader2, Receipt, Users } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { springs } from "@/components/motion/transitions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SealGlyph } from "@/components/ui/seal-glyph";
import { toast } from "@/components/ui/toast";
import { PLANS, formatInr, plansFor, type BillingOwnerType, type PlanId } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";
import { openBillingPortalAction } from "@/server/billing/actions";
import { UpgradeSheet } from "./upgrade-sheet";
import { UsageMeter, type UsageView } from "./usage-meter";

export type BillingViewProps = {
  owner: BillingOwnerType;
  mode: "stripe" | "demo";
  planId: PlanId;
  status: string;
  seats: number;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  usage: UsageView | null;
  checkout: "success" | "cancelled" | null;
  expectedPlan: PlanId | null;
};

const STATUS_LABEL: Record<string, { label: string; variant: "verified" | "coral" | "neutral" | "violet" }> = {
  active: { label: "Active", variant: "verified" },
  trialing: { label: "Trial", variant: "violet" },
  past_due: { label: "Payment failed", variant: "coral" },
  free: { label: "Free", variant: "neutral" },
};

export function BillingView(props: BillingViewProps) {
  const { owner, mode, planId, status, seats, currentPeriodEnd, cancelAtPeriodEnd, usage } = props;
  const router = useRouter();
  const plan = PLANS[planId];
  const [sheet, setSheet] = useState<{ open: boolean; plan?: PlanId }>({ open: false });
  const [portalPending, startPortal] = useTransition();
  const paid = !!plan.lookupKey;

  // After Checkout, plan state arrives by webhook: poll until it lands (max ~40 s).
  const waiting = props.checkout === "success" && (props.expectedPlan ? planId !== props.expectedPlan : !paid);
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    if (!waiting) return;
    let n = 0;
    const t = setInterval(() => {
      n += 1;
      if (n > 20) {
        clearInterval(t);
        setGaveUp(true);
        return;
      }
      router.refresh();
    }, 2000);
    return () => clearInterval(t);
  }, [waiting, router]);

  useEffect(() => {
    if (props.checkout === "cancelled") toast("Checkout cancelled. Nothing was charged.");
  }, [props.checkout]);

  // Keep the usage meter live while the page is open.
  useEffect(() => {
    if (!usage) return;
    const onFocus = () => router.refresh();
    window.addEventListener("focus", onFocus);
    const t = setInterval(() => router.refresh(), 30_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(t);
    };
  }, [usage, router]);

  const manage = () =>
    startPortal(async () => {
      const res = await openBillingPortalAction();
      if (!res.ok) return void toast.error(res.error);
      window.location.assign(res.data.url);
    });

  const st = STATUS_LABEL[status] ?? { label: status.replace(/_/g, " "), variant: "neutral" as const };
  const renews = currentPeriodEnd ? new Date(currentPeriodEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null;
  const monthly = plan.monthlyInr * (plan.perSeat ? seats : 1);

  return (
    <div className="grid gap-5">
      {mode === "demo" && (
        <div className="flex items-start gap-3 rounded-2xl border border-dashed border-violet/40 bg-violet-soft/60 p-4 text-sm">
          <FlaskConical className="mt-0.5 size-4 shrink-0 text-violet-text" aria-hidden />
          <p>
            <span className="font-semibold text-violet-text">Demo billing.</span> No Stripe key is configured here, so checkout and its webhooks
            are simulated. Nothing is charged.
          </p>
        </div>
      )}

      <AnimatePresence>
        {props.checkout === "success" && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={springs.gentle}
            className={cn("flex items-center gap-3 rounded-2xl border p-4 text-sm", waiting ? "border-line bg-surface" : "border-verified/30 bg-verified-soft")}
          >
            {waiting ? (
              <>
                <Loader2 className="size-4 shrink-0 animate-spin text-muted" aria-hidden />
                <p>{gaveUp ? "Payment received. Stripe is still confirming; refresh in a minute." : "Payment received. Waiting for Stripe to confirm your plan…"}</p>
              </>
            ) : (
              <>
                <motion.span initial={{ scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={springs.stamp}>
                  <SealGlyph className="size-5 text-verified" />
                </motion.span>
                <p>
                  You&apos;re on <span className="font-semibold">{plan.name}</span>. Confirmed by Stripe.
                </p>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <section className="relative overflow-hidden rounded-[1.4rem] border border-line bg-surface p-5 shadow-card sm:p-6" aria-labelledby="current-plan">
          {paid && <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 size-56 rounded-full bg-lime/20 blur-3xl" />}
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">Current plan</p>
              <h2 id="current-plan" className="mt-1.5 font-display text-3xl font-semibold tracking-tight">
                {plan.name}
              </h2>
            </div>
            <Badge variant={st.variant}>{cancelAtPeriodEnd ? "Ends at period end" : st.label}</Badge>
          </div>
          <dl className="relative mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-surface-2/70 p-3">
              <dt className="flex items-center gap-1.5 text-xs text-muted">
                <Receipt className="size-3.5" aria-hidden /> Monthly
              </dt>
              <dd className="mt-1 font-semibold tabular">{paid ? formatInr(monthly) : "₹0"}</dd>
            </div>
            <div className="rounded-xl bg-surface-2/70 p-3">
              <dt className="flex items-center gap-1.5 text-xs text-muted">
                <Users className="size-3.5" aria-hidden /> {plan.perSeat ? "Seats" : "Campus"}
              </dt>
              <dd className="mt-1 font-semibold tabular">{plan.perSeat ? seats : owner === "college" ? "1" : "—"}</dd>
            </div>
            <div className="col-span-2 rounded-xl bg-surface-2/70 p-3 sm:col-span-1">
              <dt className="flex items-center gap-1.5 text-xs text-muted">
                <CalendarClock className="size-3.5" aria-hidden /> {cancelAtPeriodEnd ? "Ends" : "Renews"}
              </dt>
              <dd className="mt-1 font-semibold">{renews ?? "No renewal"}</dd>
            </div>
          </dl>
          <div className="relative mt-5 flex flex-wrap gap-2.5">
            <Button onClick={() => setSheet({ open: true })}>{paid ? "Change plan" : "Upgrade"}</Button>
            <Button variant="secondary" onClick={manage} disabled={portalPending}>
              {portalPending ? <Loader2 className="animate-spin" /> : <CreditCard />} Manage billing
            </Button>
          </div>
        </section>

        {usage ? (
          <section className="rounded-[1.4rem] border border-line bg-surface p-5 shadow-card sm:p-6" aria-labelledby="usage-title">
            <p className="font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">This month</p>
            <h2 id="usage-title" className="mt-1.5 mb-4 text-lg font-semibold">
              Candidate unlocks
            </h2>
            <UsageMeter usage={usage} />
            <p className="mt-4 text-xs text-muted">An unlock reveals a candidate&apos;s contact details and opens messaging for your whole team. Each candidate counts once.</p>
          </section>
        ) : (
          <section className="rounded-[1.4rem] border border-line bg-surface p-5 shadow-card sm:p-6">
            <p className="font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">Included</p>
            <ul className="mt-3 grid gap-2 text-sm">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check className="size-4 text-verified" aria-hidden /> {f}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <section aria-labelledby="all-plans">
        <h2 id="all-plans" className="mb-3 text-sm font-semibold text-muted">
          All plans
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plansFor(owner).map((p, i) => {
            const current = p.id === planId;
            return (
              <motion.article
                key={p.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...springs.gentle, delay: i * 0.05 }}
                className={cn("flex flex-col rounded-2xl border bg-surface p-5", current ? "border-lime ring-1 ring-lime/50" : "border-line")}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-semibold">{p.name}</h3>
                  <p className="font-display text-xl font-semibold tabular">
                    {formatInr(p.monthlyInr)}
                    <span className="ml-1 font-mono text-[10.5px] font-normal text-subtle">{p.perSeat ? "/seat/mo" : "/mo"}</span>
                  </p>
                </div>
                <p className="mt-1 text-[13px] text-muted">{p.blurb}</p>
                <ul className="mt-3 grid flex-1 gap-1.5 text-[13px]">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-verified" aria-hidden /> {f}
                    </li>
                  ))}
                </ul>
                {current ? (
                  <p className="mt-4 flex h-10 items-center justify-center rounded-xl bg-surface-2 text-sm text-muted">Your plan</p>
                ) : p.lookupKey ? (
                  <Button variant="secondary" className="mt-4" onClick={() => setSheet({ open: true, plan: p.id })}>
                    {p.monthlyInr > plan.monthlyInr ? "Upgrade" : "Switch"} to {p.name.replace(/^(Recruiter|College) /, "")}
                  </Button>
                ) : (
                  <p className="mt-4 text-center text-xs text-subtle">Cancel from Manage billing to return to Free.</p>
                )}
              </motion.article>
            );
          })}
        </div>
      </section>

      <UpgradeSheet
        key={sheet.plan ?? "default"}
        open={sheet.open}
        onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
        owner={owner}
        mode={mode}
        currentPlanId={planId}
        initialPlanId={sheet.plan}
        initialSeats={plan.perSeat ? seats : 1}
        title={paid ? "Change your plan" : "Upgrade your plan"}
      />
    </div>
  );
}
