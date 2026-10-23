import { ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/server/auth/guard";
import { getStudentDrives } from "@/server/student/drives";
import { getJobsBoard } from "@/server/student/jobs";
import { JobsBoard } from "./board";
import { DrivesPanel } from "./drives-panel";

export const metadata: Metadata = { title: "Jobs" };
export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const user = await requireRole("student", "/student/jobs");
  const [{ jobs, proofScore }, drives] = await Promise.all([getJobsBoard(user.id), getStudentDrives(user.id)]);

  return (
    <>
      <PageHeader
        eyebrow="Hiring on evidence"
        title="Jobs"
        description="Every role lists the evidence it wants. The match meter compares it with your verified Proof Scores; it never stops you applying."
        actions={
          <Button variant="secondary" asChild>
            <Link href="/student/applications">
              <ClipboardList aria-hidden />
              My applications
            </Link>
          </Button>
        }
      />
      {drives.length > 0 && <DrivesPanel drives={drives} />}
      <JobsBoard jobs={jobs} proofScore={proofScore} />
    </>
  );
}
