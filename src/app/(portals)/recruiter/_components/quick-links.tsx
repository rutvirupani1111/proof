import { ArrowUpRight, type LucideIcon } from "lucide-react";
import Link from "next/link";

export type QuickLink = { icon: LucideIcon; title: string; description: string; href: string; meta?: string };

/** Dashboard jump-off grid: each tile is a real page, with an optional live figure. */
export function QuickLinks({ items }: { items: QuickLink[] }) {
  return (
    <ul className="grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line shadow-card sm:grid-cols-2 lg:grid-cols-3">
      {items.map(({ icon: Icon, title, description, href, meta }) => (
        <li key={href} className="bg-surface">
          <Link href={href} className="group flex h-full gap-3 p-4 transition-colors hover:bg-surface-2/70 focus-visible:bg-surface-2/70 focus-visible:outline-none sm:p-5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted transition-colors group-hover:bg-lime group-hover:text-lime-ink">
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="font-display text-sm font-semibold">{title}</span>
                <ArrowUpRight className="size-4 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted">{description}</span>
              {meta && <span className="mt-1.5 block font-mono text-[11px] text-subtle">{meta}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
