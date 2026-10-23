import { ArrowLeft, CalendarRange, MapPin, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/server/auth/guard";
import { getDrive } from "@/server/college/queries";
import { collegeScopeOf } from "@/server/college/scope";
import { NoCollege } from "../../_components/no-college";
import { DriveControls, DriveRoster } from "./drive-roster";

export const metadata: Metadata = { title: "Drive" };

export default async function DrivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireRole("college", `/college/drives/${id}`);
  const scope = collegeScopeOf(user);
  if (!scope) return <NoCollege />;
  const data = await getDrive(scope, id);
  if (!data) {
    return (
      <EmptyState
        icon={SearchX}
        title="Drive not found"
        description="It may belong to another college, or it was removed."
        action={
          <Button variant="secondary" asChild>
            <Link href="/college/drives">All drives</Link>
          </Button>
        }
      />
    );
  }
  const { drive, roster, newlyEligible } = data;
  const e = drive.eligibility ?? {};
  const criteria = [
    e.minProofScore ? `Proof Score ${e.minProofScore}+` : null,
    e.graduationYears?.length ? `Class of ${e.graduationYears.join(", ")}` : null,
    e.branches?.length ? e.branches.join(", ") : null,
    ...(e.skills ?? []).map((s) => `Verified ${s}`),
  ].filter((x): x is string => !!x);

  return (
    <>
      <Link href="/college/drives" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Drives
      </Link>
      <PageHeader
        eyebrow={drive.title}
        title={drive.companyName}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <CalendarRange className="size-4" aria-hidden />
              {drive.scheduledAt ? drive.scheduledAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Date to be decided"}
            </span>
            {drive.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden /> {drive.location}
              </span>
            )}
          </span>
        }
        actions={<DriveControls driveId={drive.id} status={drive.status} newlyEligible={newlyEligible} />}
      />
      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 font-mono text-[11px] tracking-wider text-subtle uppercase">Bar</span>
        {criteria.length ? criteria.map((c) => <Badge key={c} variant="outline">{c}</Badge>) : <Badge>Open to all students</Badge>}
      </div>
      <DriveRoster
        driveId={drive.id}
        rows={roster.map((r) => ({ ...r, proofScore: r.proofScore ?? 0 }))}
      />
    </>
  );
}
