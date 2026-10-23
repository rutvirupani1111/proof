import { BarChart3, Bell, CalendarRange, FileDown, GraduationCap, ShieldCheck, Target, Users } from "lucide-react";
import type { Metadata } from "next";
import { RoadmapCard } from "@/components/shell/roadmap-card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { requireRole } from "@/server/auth/guard";
import { getCollegeDashboard } from "@/server/college/queries";

export const metadata: Metadata = { title: "Placement cell" };

export default async function CollegeDashboard() {
  const user = await requireRole("college", "/college");
  const data = await getCollegeDashboard(user.collegeId as string | null | undefined);

  return (
    <>
      <PageHeader
        eyebrow={data?.college?.name ?? "Placement cell"}
        title="Cohort readiness"
        description="See who is truly job-ready, backed by verified evidence rather than self-reported skills."
      />
      {data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Students" value={data.students} icon={Users} />
          <Stat label="Avg Proof Score" value={data.avgScore} icon={Target} />
          <Stat label="Job-ready (70+)" value={data.jobReady} tone="verified" icon={ShieldCheck} />
          <Stat label="Drives" value={data.drives} icon={CalendarRange} />
        </div>
      ) : (
        <EmptyState
          icon={GraduationCap}
          title="No college linked yet"
          description="Once your college email domain is verified, your cohort appears here automatically."
        />
      )}
      <div className="mt-6">
        <RoadmapCard
          title="What lives here"
          description="A placement cell that sees evidence, not spreadsheets of claims."
          items={[
            { icon: BarChart3, title: "Cohort dashboard", description: "Verified skill distribution, readiness funnel and the top skills gap." },
            { icon: CalendarRange, title: "Company drives", description: "Schedule drives, compute eligible students, record results." },
            { icon: FileDown, title: "Placement stats", description: "Offers, packages and companies by branch and year, with CSV export." },
            { icon: Bell, title: "Nudges", description: "Remind students with incomplete proofs, in bulk or one by one." },
          ]}
        />
      </div>
    </>
  );
}
