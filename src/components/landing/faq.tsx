import { Plus } from "lucide-react";

export type FaqItem = { q: string; a: string };

/** Zero-JS accordion on <details>; keyboard and screen-reader native. */
export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-card">
      {items.map((it) => (
        <details key={it.q} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[15px] font-medium hover:bg-surface-2/60 [&::-webkit-details-marker]:hidden">
            {it.q}
            <Plus className="size-4 shrink-0 text-subtle transition-transform duration-200 group-open:rotate-45" aria-hidden />
          </summary>
          <p className="px-5 pb-5 text-sm leading-relaxed text-pretty text-muted">{it.a}</p>
        </details>
      ))}
    </div>
  );
}
