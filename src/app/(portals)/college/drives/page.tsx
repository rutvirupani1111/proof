import { CalendarRange, MapPin, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/server/auth/guard";
import { getCohortFacets, getDrives } from "@/server/college/queries";
import { collegeScopeOf } from "@/server/college/scope";
import { NoCollege } from "../_components/no-college";
import { NewDriveButton } from "./drive-form";

export const metadata: Metadata = { title: "Drives" };

const STATUS_BADGE = {
  planned: { variant: "neutral", label: "Planned" },
  open: { variant: "violet", label: "Registrations open" },
  completed: { variant: "verified", label: "Completed" },
  cancelled: { variant: "coral", label: "Cancelled" },
} as const;

export default async function DrivesPage() {
  const user = await requireRole("college", "/college/drives");
  const scope = collegeScopeOf(user);
  if (!scope) {
    return (
      <>
        <PageHeader eyebrow="Placement cell" title="Drives" />
        <NoCollege />
      </>
    );
  }
  const [drives, facets] = await Promise.all([getDrives(scope), getCohortFacets(scope)]);
  const upcoming = drives.filter((d) => d.status !== "completed" && d.status !== "cancelled");
  const past = drives.filter((d) => !upcoming.includes(d));

  return (
    <>
      <PageHeader
        eyebrow="Placement cell"
        title="Company drives"
        description="Schedule a drive, set an evidence-based bar, and every eligible student is added and notified automatically."
        actions={<NewDriveButton facets={facets} />}
      />
      {drives.length === 0 ? (
        <EmptyState icon={CalendarRange} title="No drives yet" description="Schedule your first drive; eligibility is computed from verified evidence." />
      ) : (
        <div className="grid gap-8">
          {[
            { title: "Upcoming & open", list: upcoming },
            { title: "Past", list: past },
          ]
            .filter((g) => g.list.length)
            .map((g) => (
              <section key={g.title}>
                <h2 className="mb-3 font-mono text-[11px] tracking-wider text-subtle uppercase">{g.title}</h2>
                <ul className="grid gap-3 md:grid-cols-2">
                  {g.list.map((d) => {
                    const when = d.scheduledAt;
                    const days = d.daysAway;
                    const b = STATUS_BADGE[d.status];
                    return (
                      <li key={d.id}>
                        <Card interactive className="relative flex gap-4 p-5">
                          <div className="grid w-14 shrink-0 place-items-center rounded-xl border border-line bg-surface-2 py-2 text-center">
                            <span className="font-mono text-[10px] text-subtle uppercase">{when ? when.toLocaleDateString("en-IN", { month: "short" }) : "TBD"}</span>
                            <span className="font-display text-xl font-semibold tabular">{when ? when.getDate() : "?"}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link href={`/college/drives/${d.id}`} className="font-display font-semibold after:absolute after:inset-0">
                                {d.companyName}
                              </Link>
                              <Badge variant={b.variant}>{b.label}</Badge>
                            </div>
                            <p className="truncate text-sm text-muted">{d.title}</p>
                            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-subtle">
                              {d.location && (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="size-3" aria-hidden /> {d.location}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1">
                                <Users className="size-3" aria-hidden /> {d.total} eligible · {d.registered} registered
                                {d.selected ? ` · ${d.selected} selected` : ""}
                              </span>
                              {days != null && d.status !== "completed" && (
                                <span className="font-mono">{days > 0 ? `in ${days}d` : days === 0 ? "today" : `${-days}d ago`}</span>
                              )}
                            </p>
                          </div>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
        </div>
      )}
    </>
  );
}
