"use client";

import { ArrowRight, Check, Loader2, Lock, Minus, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useState, useTransition } from "react";
import { springs } from "@/components/motion/transitions";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { PLANS, formatInr, plansFor, type BillingOwnerType, type PlanId } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";
import { startCheckoutAction } from "@/server/billing/actions";

/** Seat count stepper (1-200). */
export function SeatStepper({ value, onChange, disabled }: { value: number; onChange: (n: number) => void; disabled?: boolean }) {
  const set = (n: number) => onChange(Math.min(200, Math.max(1, n)));
  return (
    <div className="inline-flex items-center rounded-xl border border-line-strong bg-surface">
      <button type="button" aria-label="One seat fewer" disabled={disabled || value <= 1} onClick={() => set(value - 1)} className="grid size-10 place-items-center text-muted hover:text-ink disabled:opacity-40">
        <Minus className="size-4" />
      </button>
      <span className="relative w-14 overflow-hidden text-center font-mono text-sm tabular" aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={value} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} transition={springs.snappy} className="inline-block">
            {value} {value === 1 ? "seat" : "seats"}
          </motion.span>
        </AnimatePresence>
      </span>
      <button type="button" aria-label="One seat more" disabled={disabled || value >= 200} onClick={() => set(value + 1)} className="grid size-10 place-items-center text-muted hover:text-ink disabled:opacity-40">
        <Plus className="size-4" />
      </button>
    </div>
  );
}

/** Redirect to Stripe Checkout (or the demo checkout) for a plan. */
export function useCheckout() {
  const [pending, start] = useTransition();
  const checkout = (planId: PlanId, seats: number) =>
    start(async () => {
      const res = await startCheckoutAction({ planId, seats });
      if (!res.ok) return void toast.error(res.error);
      window.location.assign(res.data.url);
    });
  return { pending, checkout };
}

/**
 * The upgrade sheet: a bottom sheet on phones, a centred panel from `sm`. Opened by gated
 * features (unlocks, messaging, stats export) and by the Billing page.
 */
export function UpgradeSheet({
  open,
  onOpenChange,
  owner,
  title = "Upgrade your plan",
  reason,
  currentPlanId,
  initialPlanId,
  initialSeats = 1,
  mode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  owner: BillingOwnerType;
  title?: string;
  reason?: string;
  currentPlanId?: PlanId;
  initialPlanId?: PlanId;
  initialSeats?: number;
  mode: "stripe" | "demo";
}) {
  const paid = plansFor(owner).filter((p) => p.lookupKey);
  const [planId, setPlanId] = useState<PlanId>(initialPlanId ?? paid.find((p) => p.id !== currentPlanId)?.id ?? paid[0]!.id);
  const [seats, setSeats] = useState(initialSeats);
  const { pending, checkout } = useCheckout();
  const plan = PLANS[planId];
  const total = plan.monthlyInr * (plan.perSeat ? seats : 1);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-[2px] data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-[1.75rem] border border-line bg-surface text-ink shadow-pop focus:outline-none",
            "pb-[max(1.25rem,env(safe-area-inset-bottom))] data-[state=open]:animate-sheet-in-bottom data-[state=closed]:animate-sheet-out-bottom",
            "sm:inset-x-auto sm:top-[8vh] sm:bottom-auto sm:left-1/2 sm:w-[min(34rem,calc(100%-2rem))] sm:-translate-x-1/2 sm:rounded-[1.75rem] sm:pb-6",
            "sm:data-[state=open]:animate-pop-in sm:data-[state=closed]:animate-pop-out",
          )}
        >
          <div className="mx-auto mt-2.5 h-1.5 w-11 rounded-full bg-line-strong sm:hidden" aria-hidden />
          <div className="relative overflow-hidden px-5 pt-5 sm:px-7 sm:pt-7">
            <motion.div
              aria-hidden
              className="pointer-events-none absolute -top-24 -right-16 size-56 rounded-full bg-lime/25 blur-3xl"
              animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.9, 0.6] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.span
              initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={springs.stamp}
              className="relative grid size-11 place-items-center rounded-2xl bg-ink text-lime"
            >
              <Sparkles className="size-5" />
            </motion.span>
            <DialogPrimitive.Title className="relative mt-4 font-display text-2xl font-semibold tracking-tight">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="relative mt-1.5 text-sm text-muted">
              {reason ?? "Pick a plan. You can change seats or cancel any time from Manage billing."}
            </DialogPrimitive.Description>
          </div>

          <div role="radiogroup" aria-label="Plan" className="mt-5 grid gap-2.5 px-5 sm:px-7">
            {paid.map((p) => {
              const selected = p.id === planId;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setPlanId(p.id)}
                  className={cn("relative rounded-2xl border p-4 text-left transition-colors", selected ? "border-transparent" : "border-line hover:border-line-strong")}
                >
                  {selected && <motion.span layoutId="upgrade-plan-ring" transition={springs.snappy} className="absolute inset-0 rounded-2xl bg-lime/10 ring-2 ring-lime" />}
                  <span className="relative flex items-start justify-between gap-3">
                    <span>
                      <span className="flex items-center gap-2 font-semibold">
                        {p.name}
                        {p.id === currentPlanId && <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-subtle uppercase">Current</span>}
                      </span>
                      <span className="mt-0.5 block text-[13px] text-muted">{p.blurb}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="font-display text-lg font-semibold tabular">{formatInr(p.monthlyInr)}</span>
                      <span className="block font-mono text-[10.5px] text-subtle">{p.perSeat ? "/ seat / mo" : "/ month"}</span>
                    </span>
                  </span>
                  <AnimatePresence initial={false}>
                    {selected && (
                      <motion.ul
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={springs.gentle}
                        className="relative grid gap-1.5 overflow-hidden text-[13px]"
                      >
                        {p.features.map((f, i) => (
                          <li key={f} className={cn("flex items-center gap-2", i === 0 && "mt-3")}>
                            <Check className="size-3.5 shrink-0 text-verified" aria-hidden /> {f}
                          </li>
                        ))}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-line-strong px-5 pt-5 sm:px-7">
            {plan.perSeat ? <SeatStepper value={seats} onChange={setSeats} disabled={pending} /> : <span className="text-sm text-muted">One campus, unlimited students</span>}
            <div className="text-right">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.p key={total} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={springs.snappy} className="font-display text-2xl font-semibold tabular">
                  {formatInr(total)}
                </motion.p>
              </AnimatePresence>
              <p className="font-mono text-[10.5px] text-subtle">per month · + GST</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 px-5 sm:px-7">
            <Button size="lg" className="w-full" disabled={pending} onClick={() => checkout(planId, seats)}>
              {pending ? <Loader2 className="animate-spin" /> : <Lock />}
              {mode === "demo" ? "Continue to demo checkout" : "Continue to secure checkout"}
              {!pending && <ArrowRight />}
            </Button>
            <p className="flex items-center justify-center gap-1.5 text-center font-mono text-[10.5px] text-subtle">
              <ShieldCheck className="size-3.5" aria-hidden />
              {mode === "demo" ? "Demo mode: nothing is charged" : "Stripe test mode · card 4242 4242 4242 4242"}
            </p>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
