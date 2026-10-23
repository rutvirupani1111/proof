import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/server/auth/guard";
import { getJobs } from "@/server/recruiter/queries";
import { recruiterScopeOf } from "@/server/recruiter/scope";
import { getSearchFacets } from "@/server/search/engine";
import { NoWorkspace } from "../_components/no-workspace";
import { JobsView } from "./jobs-view";

export const metadata: Metadata = { title: "Jobs" };

export default async function JobsPage() {
  const user = await requireRole("recruiter", "/recruiter/jobs");
  const scope = recruiterScopeOf(user);
  if (!scope) {
    return (
      <>
        <PageHeader eyebrow="Workspace" title="Jobs" />
        <NoWorkspace />
      </>
    );
  }
  const [jobs, facets] = await Promise.all([getJobs(scope), getSearchFacets()]);
  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Job posts"
        description="Ask for evidence, not keywords: set the verified skills and minimum Proof Score a role needs."
      />
      <JobsView
        jobs={jobs.map((j) => ({
          ...j,
          createdAt: j.createdAt.toISOString(),
          updatedAt: j.updatedAt.toISOString(),
          applyBy: j.applyBy?.toISOString() ?? null,
        }))}
        skills={facets.skills.map((s) => ({ slug: s.slug, name: s.name }))}
      />
    </>
  );
}
