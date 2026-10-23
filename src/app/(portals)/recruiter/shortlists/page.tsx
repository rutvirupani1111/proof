import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/server/auth/guard";
import { getJobOptions, getShortlists } from "@/server/recruiter/queries";
import { recruiterScopeOf } from "@/server/recruiter/scope";
import { NoWorkspace } from "../_components/no-workspace";
import { ShortlistsView } from "./shortlists-view";

export const metadata: Metadata = { title: "Shortlists" };

export default async function ShortlistsPage() {
  const user = await requireRole("recruiter", "/recruiter/shortlists");
  const scope = recruiterScopeOf(user);
  if (!scope) {
    return (
      <>
        <PageHeader eyebrow="Talent" title="Shortlists" />
        <NoWorkspace />
      </>
    );
  }
  const [lists, jobs] = await Promise.all([getShortlists(scope), getJobOptions(scope)]);
  return (
    <>
      <PageHeader
        eyebrow="Talent"
        title="Shortlists"
        description="Candidates your team is weighing up, shared across the company. Compare any three side by side."
      />
      <ShortlistsView
        lists={lists.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() }))}
        jobs={jobs.filter((j) => j.status !== "closed").map((j) => ({ id: j.id, title: j.title }))}
      />
    </>
  );
}
