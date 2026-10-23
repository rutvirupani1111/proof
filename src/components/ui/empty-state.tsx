import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Calm, ruled-paper empty state. Say what will appear here and how to make it appear. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-line-strong bg-ledger px-6 py-12 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="mb-4 grid size-12 place-items-center rounded-2xl border border-line bg-surface shadow-card">
          <Icon className="size-5 text-muted" aria-hidden />
        </span>
      )}
      <h3 className="font-display text-base font-semibold text-balance">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-pretty text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
