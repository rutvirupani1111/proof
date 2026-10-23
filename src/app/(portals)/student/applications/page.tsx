import { Briefcase, CalendarCheck, ClipboardList, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { requireRole } from "@/server/auth/guard";
import { getApplications } from "@/server/student/jobs";
import { ApplicationsTracker } from "./tracker";

export const metadata: Metadata = { title: "Applications" };
export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const user = await requireRole("student", "/student/applications");
  const apps = await getApplications(user.id);
  const active = apps.filter((a) => !["rejected", "withdrawn", "hired"].includes(a.stage));
  const interviews = apps.filter((a) => a.stage === "interview").length;
  const offers = apps.filter((a) => a.stage === "offer" || a.stage === "hired").length;

  return (
    <>
      <PageHeader
        eyebrow="Hiring"
        title="Applications"
        description="Every role you applied to and where it stands. Stages update as recruiters move you through their pipeline."
        actions={
          <Button variant="secondary" asChild>
            <Link href="/student/jobs">
              <Briefcase aria-hidden />
              Browse jobs
            </Link>
          </Button>
        }
      />
      {apps.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No applications yet"
          description="Apply with your verified evidence; recruiters see your Proof profile, not a resume."
          action={
            <Button asChild>
              <Link href="/student/jobs">Find a role</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-3 gap-3">
            <Stat label="Active" value={active.length} icon={ClipboardList} />
            <Stat label="Interviews" value={interviews} icon={CalendarCheck} />
            <Stat label="Offers" value={offers} tone="verified" icon={Trophy} />
          </div>
          <ApplicationsTracker applications={apps} />
        </>
      )}
    </>
  );
}
