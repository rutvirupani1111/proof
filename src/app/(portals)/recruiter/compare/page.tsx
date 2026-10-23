import { GitCompare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SealGlyph } from "@/components/ui/seal-glyph";
import { cn } from "@/lib/utils";
import { compareIdsSchema } from "@/lib/validation/recruiter";
import { requireRole } from "@/server/auth/guard";
import { getCompare } from "@/server/recruiter/queries";
import { ScoreRing } from "../_components/score-ring";

export const metadata: Metadata = { title: "Compare candidates" };

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  await requireRole("recruiter", "/recruiter/compare");
  const { ids } = await searchParams;
  const parsed = compareIdsSchema.safeParse((ids ?? "").split(",").filter(Boolean).slice(0, 3));
  const people = parsed.success ? await getCompare(parsed.data) : [];

  if (people.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Talent" title="Compare" />
        <EmptyState
          icon={GitCompare}
          title="Pick up to three candidates"
          description="Use Compare on search results or a shortlist; their evidence lines up here side by side."
          action={
            <Button asChild>
              <Link href="/recruiter/search">Open evidence search</Link>
            </Button>
          }
        />
      </>
    );
  }

  const skillNames = new Map<string, string>();
  for (const p of people) for (const s of p.skills) skillNames.set(s.slug, s.name);
  const skillRows = [...skillNames.entries()]
    .map(([slug, name]) => ({ slug, name, best: Math.max(...people.map((p) => p.skills.find((s) => s.slug === slug)?.score ?? 0)) }))
    .sort((a, b) => b.best - a.best)
    .slice(0, 12);

  type Row = { label: string; values: number[]; format?: (n: number) => string };
  const factRows: Row[] = [
    { label: "Proof Score", values: people.map((p) => p.proofScore) },
    { label: "Own commits", values: people.map((p) => p.ownCommits) },
    { label: "Live deployments", values: people.map((p) => p.liveDeployments) },
    { label: "Checks passed", values: people.map((p) => p.passedChecks) },
    { label: "Mentor endorsements", values: people.map((p) => p.endorsements) },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Talent"
        title="Side by side"
        description="Evidence lined up row by row. The strongest value in each row carries the seal."
        actions={
          <Button variant="secondary" asChild>
            <Link href="/recruiter/search">Back to search</Link>
          </Button>
        }
      />
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface shadow-card">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <caption className="sr-only">Candidate comparison</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="sticky left-0 z-10 w-36 bg-surface p-4 text-left font-mono text-[11px] font-medium tracking-wider text-subtle uppercase">
                Candidate
              </th>
              {people.map((p) => (
                <th key={p.userId} scope="col" className="p-4 text-left align-top font-normal">
                  <div className="flex items-start gap-3">
                    <Avatar name={p.name} src={p.image} size="md" />
                    <div className="min-w-0">
                      <Link href={`/recruiter/candidates/${p.userId}`} className="font-display font-semibold hover:underline">
                        {p.name}
                      </Link>
                      <p className="line-clamp-2 text-xs text-muted">{p.headline}</p>
                      <p className="mt-1 text-xs text-subtle">
                        {p.collegeName}
                        {p.graduationYear ? ` · ’${String(p.graduationYear).slice(2)}` : ""}
                      </p>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-line bg-ledger">
              <th scope="row" className="sticky left-0 z-10 bg-surface p-4 text-left text-muted">
                Score
              </th>
              {people.map((p) => (
                <td key={p.userId} className="p-4">
                  <ScoreRing score={p.proofScore} size={64} />
                </td>
              ))}
            </tr>
            {factRows.slice(1).map((row) => {
              const best = Math.max(...row.values);
              return (
                <tr key={row.label} className="border-b border-line">
                  <th scope="row" className="sticky left-0 z-10 bg-surface p-4 text-left font-normal text-muted">
                    {row.label}
                  </th>
                  {row.values.map((v, i) => (
                    <td key={people[i]!.userId} className={cn("p-4 font-mono tabular", v === best && v > 0 ? "font-semibold text-verified" : "text-ink")}>
                      <span className="inline-flex items-center gap-1.5">
                        {v === best && v > 0 && <SealGlyph className="size-3.5 text-lime" />}
                        {v}
                      </span>
                    </td>
                  ))}
                </tr>
              );
            })}
            <tr className="border-b border-line bg-surface-2/60">
              <th scope="rowgroup" colSpan={people.length + 1} className="px-4 py-2 text-left font-mono text-[11px] font-medium tracking-wider text-subtle uppercase">
                Verified skills
              </th>
            </tr>
            {skillRows.map((s) => (
              <tr key={s.slug} className="border-b border-line last:border-0">
                <th scope="row" className="sticky left-0 z-10 bg-surface px-4 py-3 text-left font-normal">
                  {s.name}
                </th>
                {people.map((p) => {
                  const v = p.skills.find((x) => x.slug === s.slug)?.score ?? 0;
                  return (
                    <td key={p.userId} className="px-4 py-3">
                      {v > 0 ? (
                        <div className="flex items-center gap-2">
                          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-3">
                            <span className={cn("block h-full rounded-full", v === s.best ? "bg-lime" : "bg-violet/70")} style={{ width: `${v}%` }} />
                          </span>
                          <span className={cn("font-mono text-xs tabular", v === s.best && "font-semibold text-verified")}>{v}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-subtle">no evidence</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
