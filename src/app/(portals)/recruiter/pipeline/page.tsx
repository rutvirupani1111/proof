import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/server/auth/guard";
import { getJobOptions, getPipelineBoard } from "@/server/recruiter/queries";
import { recruiterScopeOf } from "@/server/recruiter/scope";
import { NoWorkspace } from "../_components/no-workspace";
import { JobFilter } from "./job-filter";
import { PipelineBoard } from "./pipeline-board";

export const metadata: Metadata = { title: "Pipeline" };

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const user = await requireRole("recruiter", "/recruiter/pipeline");
  const scope = recruiterScopeOf(user);
  const { job } = await searchParams;
  if (!scope) {
    return (
      <>
        <PageHeader eyebrow="Talent" title="Pipeline" />
        <NoWorkspace />
      </>
    );
  }
  const jobs = await getJobOptions(scope);
  const jobId = job && jobs.some((j) => j.id === job) ? job : null;
  const cards = await getPipelineBoard(scope, jobId);

  return (
    <>
      <PageHeader
        eyebrow="Talent"
        title="Pipeline"
        description="Drag candidates between stages, or use a card's menu. Moves save instantly and only your company sees this board."
        actions={
          <>
            <JobFilter jobs={jobs.map((j) => ({ id: j.id, title: j.title }))} value={jobId} />
            <Button variant="secondary" asChild>
              <Link href="/recruiter/search">Source candidates</Link>
            </Button>
          </>
        }
      />
      <PipelineBoard key={jobId ?? "all"} initial={cards} />
    </>
  );
}
