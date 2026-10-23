import { Award, Building, Download, TrendingUp, Users } from "lucide-react";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/auth/guard";
import { getPlacementStats } from "@/server/college/queries";
import { collegeScopeOf } from "@/server/college/scope";
import { NoCollege } from "../_components/no-college";

export const metadata: Metadata = { title: "Placement stats" };

export default async function StatsPage() {
  const user = await requireRole("college", "/college/stats");
  const scope = collegeScopeOf(user);
  if (!scope) {
    return (
      <>
        <PageHeader eyebrow="Placement cell" title="Placement stats" />
        <NoCollege />
      </>
    );
  }
  const s = await getPlacementStats(scope);
  const rate = s.totals.students ? Math.round((s.totals.placed / s.totals.students) * 100) : 0;

  return (
    <>
      <PageHeader
        eyebrow="Placement cell"
        title="Placement stats"
        description="Offers from drives and from Proof job applications, by branch and year."
        actions={
          <Button variant="secondary" asChild>
            <a href="/college/stats/export" download>
              <Download /> Export CSV
            </a>
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Placed" value={s.totals.placed} tone="verified" icon={Award} hint={`${rate}% of ${s.totals.students}`} />
        <Stat label="Offers" value={s.totals.offers} icon={TrendingUp} />
        <Stat label="Companies" value={s.totals.companies} icon={Building} />
        <Stat label="Avg score, placed" value={s.totals.avgScorePlaced} icon={Users} hint={`vs ${s.totals.avgScoreOthers} for the rest`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>By branch and year</CardTitle>
            <CardDescription>Placement rate per group, with the average Proof Score.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[26rem] text-sm">
              <caption className="sr-only">Placements by branch and graduation year</caption>
              <thead>
                <tr className="border-b border-line text-left font-mono text-[11px] tracking-wider text-subtle uppercase">
                  <th scope="col" className="py-2 pr-3 font-medium">Branch</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Year</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Placed</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Rate</th>
                  <th scope="col" className="py-2 text-right font-medium">Avg score</th>
                </tr>
              </thead>
              <tbody>
                {s.byGroup.map((g) => (
                  <tr key={`${g.branch}-${g.year}`} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-3">{g.branch}</td>
                    <td className="py-2.5 pr-3 font-mono">{g.year ?? "n/a"}</td>
                    <td className="py-2.5 pr-3 text-right font-mono tabular">
                      {g.placed}/{g.students}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                          <span className={cn("block h-full rounded-full", g.rate >= 0.5 ? "bg-lime" : "bg-violet")} style={{ width: `${g.rate * 100}%` }} />
                        </span>
                        <span className="font-mono text-xs tabular">{Math.round(g.rate * 100)}%</span>
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-mono tabular">{g.avgScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Hiring companies</CardTitle>
          </CardHeader>
          <CardContent>
            {s.companies.length ? (
              <ul className="grid gap-2">
                {s.companies.map((c) => (
                  <li key={c.name} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{c.name}</span>
                    <Badge variant="verified" mono>
                      {c.n}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No offers recorded yet. Mark students as selected on a drive.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Placements</CardTitle>
          <CardDescription>{s.placements.length} offers. The CSV export contains exactly these rows.</CardDescription>
        </CardHeader>
        <CardContent>
          {s.placements.length ? (
            <ul className="divide-y divide-line">
              {s.placements.map((p, i) => (
                <li key={`${p.studentUserId}-${p.company}-${i}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-muted"> · {p.branch ?? "n/a"}{p.graduationYear ? ` ’${String(p.graduationYear).slice(2)}` : ""}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span>{p.company}</span>
                    {p.result && <Badge variant="outline">{p.result}</Badge>}
                    <Badge mono>{p.source}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nothing yet.</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
