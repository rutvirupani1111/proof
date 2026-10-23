import { Briefcase, Building2, KanbanSquare, ListChecks, MessageSquare, Search, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { requireRole } from "@/server/auth/guard";
import { getRecruiterDashboard } from "@/server/recruiter/queries";
import { QuickLinks } from "./_components/quick-links";

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
          <>
            {user.domainVerification === "pending" ? (
              <Badge variant="coral">Company domain unverified</Badge>
            ) : (
              <Badge variant="verified">Company verified</Badge>
            )}
            <Button asChild>
              <Link href="/recruiter/search">
                <Search /> Search evidence
              </Link>
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open jobs" value={data.openJobs} icon={Briefcase} />
        <Stat label="In pipeline" value={data.pipeline} icon={KanbanSquare} />
        <Stat label="Shortlists" value={data.shortlists} icon={ListChecks} />
        <Stat label="Job-ready (70+)" value={data.ready} tone="verified" icon={ShieldCheck} hint={`of ${data.searchable} searchable profiles`} />
      </div>
      <div className="mt-6">
        <QuickLinks
          items={[
            { icon: Search, title: "Evidence search", description: "Filter by verified skill, score, live apps, own commits, checks, endorsements, college and year.", href: "/recruiter/search", meta: `${data.searchable} searchable profiles` },
            { icon: KanbanSquare, title: "Pipeline", description: "Drag candidates from Sourced to Hired. Only your team sees it.", href: "/recruiter/pipeline", meta: `${data.pipeline} cards` },
            { icon: ListChecks, title: "Shortlists", description: "Shared lists; compare any three side by side.", href: "/recruiter/shortlists", meta: `${data.shortlists} lists` },
            { icon: Briefcase, title: "Job posts", description: "Ask for verified skills and a minimum Proof Score.", href: "/recruiter/jobs", meta: `${data.openJobs} open` },
            { icon: MessageSquare, title: "Messages", description: "Talk to candidates in-app.", href: "/recruiter/messages" },
            { icon: Building2, title: "Company", description: "Domain verification and teammates.", href: "/recruiter/company" },
          ]}
        />
      </div>
    </>
  );
}
