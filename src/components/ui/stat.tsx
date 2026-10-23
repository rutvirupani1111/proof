import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A ledger figure: mono label, display number, optional delta and hint. */
export function Stat({
  label,
  value,
  delta,
  hint,
  icon: Icon,
  tone = "default",
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  /** Positive renders lime-up, negative coral-down. */
  delta?: number;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "verified";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card",
        tone === "verified" && "border-verified/30",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] tracking-wider text-subtle uppercase">{label}</span>
        {Icon && <Icon className="size-4 text-subtle" aria-hidden />}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span
          className={cn(
            "font-display text-3xl font-semibold tracking-tight tabular",
            tone === "verified" && "text-verified",
          )}
        >
          {value}
        </span>
        {typeof delta === "number" && delta !== 0 && (
          <span
            className={cn(
              "inline-flex items-center text-xs font-medium tabular",
              delta > 0 ? "text-verified" : "text-coral-text",
            )}
          >
            {delta > 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(delta)}
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
