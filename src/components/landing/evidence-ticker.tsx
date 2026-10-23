import Link from "next/link";
import { KIND_META } from "@/components/profile/kind-meta";
import { SealGlyph } from "@/components/ui/seal-glyph";
import { timeAgo } from "@/lib/utils";
import type { TickerItem } from "@/server/public/queries";

/**
 * Live evidence ticker: the latest verified items from PUBLIC profiles, as a CSS-only marquee
 * (no JS). Pauses on hover and focus; reduced motion turns it into a scrollable row.
 */
export function EvidenceTicker({ items }: { items: TickerItem[] }) {
  if (items.length === 0) return null;
  const row = items.map((it) => ({ ...it, ago: timeAgo(it.at) }));
  return (
    <section aria-label="Recently verified evidence" className="relative border-y border-line bg-surface/70">
      <style>{`@keyframes proof-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
      <div className="flex items-stretch">
        <p className="relative z-10 hidden shrink-0 items-center gap-2 border-r border-line bg-surface px-5 font-mono text-[11px] tracking-[0.14em] text-subtle uppercase sm:flex">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-lime opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-lime" />
          </span>
          Live evidence
        </p>
        <div className="group relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)] motion-reduce:overflow-x-auto">
          <ul className="flex w-max animate-[proof-marquee_70s_linear_infinite] group-focus-within:[animation-play-state:paused] group-hover:[animation-play-state:paused] motion-reduce:animate-none">
            {[0, 1].map((copy) =>
              row.map((it) => {
                const Icon = KIND_META[it.kind].icon;
                return (
                  <li key={`${copy}-${it.id}`} aria-hidden={copy === 1 || undefined} className="flex items-center">
                    <Link
                      href={`/u/${it.handle}`}
                      tabIndex={copy === 1 ? -1 : undefined}
                      className="flex items-center gap-2.5 px-5 py-3.5 text-sm whitespace-nowrap hover:bg-surface-2"
                    >
                      <SealGlyph className="size-4 shrink-0 text-verified" />
                      <span className="font-medium">{it.who}</span>
                      <Icon className="size-3.5 text-subtle" aria-hidden />
                      <span className="text-muted">{it.title}</span>
                      {it.ago && <span className="font-mono text-[11px] text-subtle">{it.ago}</span>}
                    </Link>
                  </li>
                );
              }),
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
