"use client";

import { motion } from "motion/react";
import { springs } from "@/components/motion/transitions";
import { UNLOCK_OVERAGE_INR, formatInr } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

export type UsageView = { used: number; allowance: number; billable: number; resetsAt: string; metered: boolean };

/** Monthly candidate-unlock meter: included allowance in lime, metered overage in violet. */
export function UsageMeter({ usage, compact = false }: { usage: UsageView; compact?: boolean }) {
  const { used, allowance, billable, metered } = usage;
  const cap = Math.max(allowance, used, 1);
  const included = Math.min(used, allowance);
  const pctIncluded = (included / cap) * 100;
  const pctOver = (Math.max(0, used - allowance) / cap) * 100;
  const left = Math.max(0, allowance - used);
  const atLimit = !metered && used >= allowance;
  const resets = new Date(usage.resetsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

  return (
    <div className={cn("grid", compact ? "gap-1.5" : "gap-2.5")}>
      <div className="flex items-baseline justify-between gap-3">
        <p className={cn("font-semibold tabular", compact ? "text-sm" : "font-display text-2xl")}>
          {used}
          <span className="text-muted"> / {allowance}</span>
          <span className={cn("ml-1.5 font-sans font-normal text-muted", compact ? "text-xs" : "text-sm")}>unlocks</span>
        </p>
        <p className={cn("font-mono text-[11px]", atLimit ? "text-coral-text" : "text-subtle")}>
          {atLimit ? "Limit reached" : `${left} left`} · resets {resets}
        </p>
      </div>
      <div
        role="meter"
        aria-label="Candidate unlocks this month"
        aria-valuemin={0}
        aria-valuemax={allowance}
        aria-valuenow={used}
        className={cn("relative flex overflow-hidden rounded-full bg-surface-2 ring-1 ring-line ring-inset", compact ? "h-2" : "h-3")}
      >
        <motion.span
          className={cn("h-full", atLimit ? "bg-coral" : "bg-lime")}
          initial={{ width: 0 }}
          animate={{ width: `${pctIncluded}%` }}
          transition={springs.gentle}
        />
        {pctOver > 0 && (
          <motion.span className="h-full bg-violet" initial={{ width: 0 }} animate={{ width: `${pctOver}%` }} transition={{ ...springs.gentle, delay: 0.15 }} />
        )}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent"
          initial={{ left: "-35%" }}
          animate={{ left: "135%" }}
          transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 2.5, ease: "easeInOut" }}
        />
      </div>
      {!compact && metered && (
        <p className="text-xs text-muted">
          {billable > 0
            ? `${billable} extra ${billable === 1 ? "unlock" : "unlocks"} this month, billed at ${formatInr(UNLOCK_OVERAGE_INR)} each on your next invoice.`
            : `Beyond your allowance, unlocks keep working at ${formatInr(UNLOCK_OVERAGE_INR)} each.`}
        </p>
      )}
    </div>
  );
}
