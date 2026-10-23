import { Briefcase, Columns3, GitCompare, KanbanSquare, ListChecks, MessageSquare, Search, ShieldCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import { RoadmapCard } from "@/components/shell/roadmap-card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { requireRole } from "@/server/auth/guard";
import { getRecruiterDashboard } from "@/server/recruiter/queries";

export const metadata: Metadata = { title: "Recruiter dashboard" };

export default async function RecruiterDashboard() {
  const user = await requireRole("recruiter", "/recruiter");
  const data = await getRecruiterDashboard(user.companyId as string | null | undefined);

  return (
    <>
      <PageHeader
        eyebrow={data.company?.name ?? "Recruiter workspace"}
        title="Hire on evidence"
        description="Search verified skills instead of keywords. Every candidate here has proof behind the profile."
        actions={
          user.domainVerification === "pending" ? (
            <Badge variant="coral">Company domain unverified</Badge>
          ) : (
            <Badge variant="verified">Company verified</Badge>
          )
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open jobs" value={data.openJobs} icon={Briefcase} />
        <Stat label="In pipeline" value={data.pipeline} icon={KanbanSquare} />
        <Stat label="Shortlists" value={data.shortlists} icon={ListChecks} />
        <Stat label="Job-ready (70+)" value={data.ready} tone="verified" icon={ShieldCheck} hint={`of ${data.searchable} public profiles`} />
      </div>
      <div className="mt-6">
        <RoadmapCard
          title="What lives here"
          description="The recruiter portal is a search engine over evidence, plus the tools to run a hiring pipeline."
          items={[
            { icon: Search, title: "Evidence search", description: "Filter by skill, minimum Proof Score, live deployments, own commits, passed checks, endorsements, college, year." },
            { icon: GitCompare, title: "Candidate compare", description: "Evidence-first candidate view; compare up to three side by side." },
            { icon: ListChecks, title: "Shortlists & saved searches", description: "Keep the best candidates and re-run searches as new evidence lands." },
            { icon: Columns3, title: "Pipeline kanban", description: "Drag candidates through Sourced, Contacted, Skill check, Interview, Offer, Hired." },
            { icon: MessageSquare, title: "Messages & notes", description: "Talk to candidates in-app; keep private notes visible to your team." },
            { icon: Users, title: "Company workspace", description: "Verify your company email domain and invite teammates." },
          ]}
        />
      </div>
    </>
  );
}
