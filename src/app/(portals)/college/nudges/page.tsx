import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/server/auth/guard";
import { getCohortStudents } from "@/server/college/queries";
import { collegeScopeOf } from "@/server/college/scope";
import { NoCollege } from "../_components/no-college";
import { NudgeView } from "./nudge-view";

export const metadata: Metadata = { title: "Nudges" };

export default async function NudgesPage() {
  const user = await requireRole("college", "/college/nudges");
  const scope = collegeScopeOf(user);
  if (!scope) {
    return (
      <>
        <PageHeader eyebrow="Placement cell" title="Nudges" />
        <NoCollege />
      </>
    );
  }
  const students = await getCohortStudents(scope);
  return (
    <>
      <PageHeader
        eyebrow="Placement cell"
        title="Nudge incomplete proofs"
        description="Each student gets an in-app notification naming their next missing proof. Pick a gap to target, or select students one by one."
      />
      <NudgeView
        students={students
          .filter((s) => s.gaps.length > 0)
          .map((s) => ({ userId: s.userId, name: s.name, image: s.image, branch: s.branch, graduationYear: s.graduationYear, proofScore: s.proofScore, gaps: s.gaps }))}
        total={students.length}
      />
    </>
  );
}
