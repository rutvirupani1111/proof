import { FolderGit2 } from "lucide-react";
import Link from "next/link";
import { SealGlyph } from "@/components/ui/seal-glyph";
import type { TimelineEntry } from "@/server/public/queries";
import { formatDay, formatMonth, KIND_META } from "./kind-meta";

/** Ledger-style work timeline, newest first, grouped by month. Repo spans show when work began. */
export function WorkTimeline({ entries, limit = 14 }: { entries: TimelineEntry[]; limit?: number }) {
  const shown = entries.slice(0, limit);
  const groups: { month: string; items: TimelineEntry[] }[] = [];
  for (const e of shown) {
    const m = formatMonth(e.at);
    const g = groups.at(-1);
    if (g && g.month === m) g.items.push(e);
    else groups.push({ month: m, items: [e] });
  }
  return (
    <ol className="grid gap-6">
      {groups.map((g) => (
        <li key={g.month} className="grid gap-3 sm:grid-cols-[5rem_1fr] sm:gap-x-6">
          <p className="pt-0.5 font-mono text-[11px] tracking-[0.12em] text-subtle uppercase">{g.month}</p>
          <ol className="ml-2.5 grid gap-4 border-l border-line-strong">
            {g.items.map((e) => {
              const isSpan = e.kind === "repo_span";
              const Icon = isSpan ? FolderGit2 : KIND_META[e.kind as keyof typeof KIND_META].icon;
              return (
                <li key={e.id} className="relative pl-6">
                  <span className="absolute top-0.5 -left-2.5 grid size-5 place-items-center rounded-full border border-line bg-surface" aria-hidden>
                    {isSpan ? <span className="size-1.5 rounded-full bg-line-strong" /> : <SealGlyph className="size-4 text-verified" />}
                  </span>
                  <p className="flex items-start gap-1.5 text-sm font-medium">
                    <Icon className="mt-0.5 size-3.5 shrink-0 text-subtle" aria-hidden />
                    <span>{e.title}</span>
                  </p>
                  {e.detail && <p className="mt-0.5 text-[13px] text-muted">{e.detail}</p>}
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 font-mono text-[11px] text-subtle">
                    {isSpan && e.until ? (
                      <span>
                        {formatDay(e.at)} → {formatDay(e.until)}
                      </span>
                    ) : (
                      <span>{formatDay(e.at)}</span>
                    )}
                    {e.credentialId && (
                      <Link href={`/verify/${e.credentialId}`} className="text-verified hover:underline">
                        credential
                      </Link>
                    )}
                  </p>
                </li>
              );
            })}
          </ol>
        </li>
      ))}
    </ol>
  );
}
