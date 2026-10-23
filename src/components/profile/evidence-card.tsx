import { ArrowUpRight, Pin } from "lucide-react";
import Link from "next/link";
import { SealGlyph } from "@/components/ui/seal-glyph";
import { cn } from "@/lib/utils";
import type { DossierEvidence } from "@/server/public/queries";
import { formatDay, KIND_META } from "./kind-meta";

/**
 * An evidence "slip": ruled paper, a perforated edge, the facts captured at verification time in
 * mono, and a lime seal pressed into the corner. Links out to the source and the signed credential.
 */
export function EvidenceCard({ ev, pinned, skillNames }: { ev: DossierEvidence; pinned?: boolean; skillNames: Map<string, string> }) {
  const meta = KIND_META[ev.kind];
  const Icon = meta.icon;
  const statement = ev.facts.find((f) => f.label === "Statement");
  const facts = ev.facts.filter((f) => f.label !== "Statement").slice(0, 4);
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface bg-ledger shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-pop">
      <div className="h-1.5 w-full bg-[radial-gradient(circle_at_4px_0,var(--canvas)_3px,transparent_3.5px)] bg-[length:12px_6px]" aria-hidden />
      <SealGlyph
        className="pointer-events-none absolute -top-1 -right-1 size-14 -rotate-12 text-lime opacity-90 drop-shadow-[0_4px_10px_rgb(0_0_0/0.15)] transition-transform duration-300 group-hover:-rotate-[20deg]"
        aria-hidden
      />
      <div className="flex flex-1 flex-col p-5 pt-4">
        <p className="flex items-center gap-1.5 pr-12 font-mono text-[10.5px] tracking-[0.14em] text-subtle uppercase">
          <Icon className="size-3.5 text-verified" aria-hidden />
          {meta.label}
          {pinned && (
            <span className="ml-1 inline-flex items-center gap-0.5 text-violet-text">
              <Pin className="size-3" aria-hidden /> pinned
            </span>
          )}
        </p>
        <h3 className="mt-2 pr-10 text-[1.05rem] leading-snug font-semibold text-balance">{ev.title}</h3>
        {ev.summary && <p className="mt-1 text-sm text-muted">{ev.summary}</p>}
        {statement && <blockquote className="mt-3 border-l-2 border-lime pl-3 text-sm text-pretty italic">{statement.value}</blockquote>}
        {facts.length > 0 && (
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-dashed border-line-strong pt-3">
            {facts.map((f) => (
              <div key={f.label} className="min-w-0">
                <dt className="text-[11px] text-subtle">{f.label}</dt>
                <dd className="truncate font-mono text-[12.5px]" title={f.value}>
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {ev.skillSlugs.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Skills this proves">
            {ev.skillSlugs.map((s) => (
              <li key={s} className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
                {skillNames.get(s) ?? s}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-4 text-xs">
          {ev.verifiedAt && <span className="font-mono text-subtle">Verified {formatDay(ev.verifiedAt)}</span>}
          <span className="ml-auto flex items-center gap-3">
            {ev.sourceUrl && (
              <a
                href={ev.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-0.5 text-violet-text hover:underline"
                aria-label={`Open source: ${ev.sourceLabel ?? ev.sourceUrl}`}
              >
                Source <ArrowUpRight className="size-3" aria-hidden />
              </a>
            )}
            {ev.credentialId ? (
              <Link href={`/verify/${ev.credentialId}`} className={cn("inline-flex items-center gap-1 font-medium text-verified hover:underline")}>
                <SealGlyph className="size-3.5" /> Verify credential
              </Link>
            ) : (
              <span className="text-subtle">Credential pending</span>
            )}
          </span>
        </div>
      </div>
    </article>
  );
}
