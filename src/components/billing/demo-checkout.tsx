"use client";

import { ArrowLeft, Check, CreditCard, FlaskConical, Loader2, Lock } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { springs } from "@/components/motion/transitions";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { PLANS, formatInr, type PlanId } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";
import { cancelDemoPlanAction, completeDemoCheckoutAction } from "@/server/billing/actions";

const STEPS = ["Card authorised (demo)", "checkout.session.completed", "customer.subscription.updated", "Plan active"];

/**
 * Stand-in for Stripe Checkout and the Customer Portal when no STRIPE_SECRET_KEY is set. "Paying"
 * runs the same webhook event handler the real integration uses, with synthetic events.
 */
export function DemoCheckout({
  portal,
  planId,
  seats,
  currentPlanId,
  currentSeats,
  email,
}: {
  portal: "recruiter" | "college";
  planId: PlanId | null;
  seats: number;
  currentPlanId: PlanId;
  currentSeats: number;
  email: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [step, setStep] = useState(-1);
  const plan = planId ? PLANS[planId] : PLANS[currentPlanId];
  const qty = plan.perSeat ? (planId ? seats : currentSeats) : 1;
  const total = plan.monthlyInr * qty;
  const back = `/${portal}/billing`;

  const pay = () =>
    start(async () => {
      if (!planId) return;
      setStep(0);
      const res = await completeDemoCheckoutAction({ planId, seats });
      if (!res.ok) {
        setStep(-1);
        return void toast.error(res.error);
      }
      for (let i = 1; i < STEPS.length; i++) {
        await new Promise((r) => setTimeout(r, 420));
        setStep(i);
      }
      await new Promise((r) => setTimeout(r, 500));
      router.push(`${back}?checkout=success&plan=${planId}`);
    });

  const cancel = () =>
    start(async () => {
      const res = await cancelDemoPlanAction();
      if (!res.ok) return void toast.error(res.error);
      toast.success("Demo plan cancelled. You're back on Free.");
      router.push(back);
    });

  return (
    <div className="mx-auto grid w-full max-w-md gap-4 py-2">
      <Link href={back} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Back to billing
      </Link>
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-violet/40 bg-violet-soft/60 px-3 py-2 text-[13px] text-violet-text">
        <FlaskConical className="size-4 shrink-0" aria-hidden />
        <span>
          <span className="font-semibold">Demo checkout.</span> No Stripe key here: events are simulated and nothing is charged.
        </span>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springs.gentle}
        className="overflow-hidden rounded-[1.4rem] border border-line bg-surface shadow-pop"
      >
        <div className="border-b border-line bg-surface-2/60 p-5">
          <p className="font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">{planId ? "Subscribe to" : "Demo billing portal"}</p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Proof {plan.name}</h1>
          <p className="mt-3 font-display text-4xl font-semibold tabular">
            {formatInr(total)}
            <span className="ml-1.5 font-sans text-sm font-normal text-muted">per month</span>
          </p>
          {plan.perSeat && (
            <p className="mt-1 text-sm text-muted">
              {qty} {qty === 1 ? "seat" : "seats"} × {formatInr(plan.monthlyInr)}
              {plan.metered && " · extra unlocks ₹49 each"}
            </p>
          )}
        </div>

        {planId ? (
          <div className="grid gap-4 p-5">
            <div className="grid gap-1.5 text-sm">
              <span className="text-muted">Email</span>
              <span className="rounded-xl border border-line bg-surface-2/50 px-3 py-2.5">{email}</span>
            </div>
            <div className="grid gap-1.5 text-sm">
              <span className="text-muted">Card (test)</span>
              <span className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/50 px-3 py-2.5 font-mono tabular">
                <CreditCard className="size-4 text-muted" aria-hidden /> 4242 4242 4242 4242
                <span className="ml-auto text-subtle">12/34 · 123</span>
              </span>
            </div>
            <Button size="lg" onClick={pay} disabled={pending || step >= 0} className="w-full">
              {pending ? <Loader2 className="animate-spin" /> : <Lock />} Pay {formatInr(total)} (demo)
            </Button>
            <AnimatePresence>
              {step >= 0 && (
                <motion.ol initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} transition={springs.gentle} className="grid gap-2 overflow-hidden">
                  {STEPS.map((s, i) => (
                    <li key={s} className={cn("flex items-center gap-2.5 text-sm transition-colors", i <= step ? "text-ink" : "text-subtle")}>
                      <span className={cn("grid size-5 place-items-center rounded-full border", i <= step ? "border-transparent bg-lime text-lime-ink" : "border-line")}>
                        {i < step || (i === step && i === STEPS.length - 1) ? (
                          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={springs.stamp}>
                            <Check className="size-3" />
                          </motion.span>
                        ) : i === step ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : null}
                      </span>
                      <span className={cn(i > 0 && i < STEPS.length - 1 && "font-mono text-[12.5px]")}>{s}</span>
                    </li>
                  ))}
                </motion.ol>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="grid gap-3 p-5 text-sm">
            {plan.lookupKey ? (
              <>
                <p className="text-muted">In production this opens the Stripe Customer Portal (invoices, card, seats, cancel).</p>
                <Button variant="danger" onClick={cancel} disabled={pending}>
                  {pending && <Loader2 className="animate-spin" />} Cancel demo plan
                </Button>
              </>
            ) : (
              <p className="text-muted">You&apos;re on the Free plan. Choose a plan on the Billing page to try the demo checkout.</p>
            )}
          </div>
        )}
      </motion.section>
    </div>
  );
}
