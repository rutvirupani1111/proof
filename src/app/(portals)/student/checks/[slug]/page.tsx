import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/server/auth/guard";
import { getCheckForRunner } from "@/server/student/proofs";
import { CheckRunner } from "./check-runner";

export const metadata: Metadata = { title: "Skill check" };

export default async function CheckPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireRole("student", `/student/checks/${slug}`);
  const data = await getCheckForRunner(user.id, slug);
  if (!data) notFound();
  const { check, hiddenCount, history } = data;
  const best = history.reduce<number | null>((b, a) => (a.score != null && (b == null || a.score > b) ? a.score : b), null);
  const lastCode = history.find((a) => a.code && a.status !== "invited")?.code;

  return (
    <CheckRunner
      check={{
        slug: check.slug,
        title: check.title,
        level: check.level,
        prompt: check.prompt,
        starterCode: check.starterCode,
        entryFunction: check.entryFunction,
        sampleTests: check.sampleTests,
        timeLimitSec: check.timeLimitSec,
        skill: check.skill?.name ?? null,
        hiddenCount,
      }}
      initialCode={lastCode ?? check.starterCode}
      best={best}
      history={history.map((h) => ({
        id: h.id,
        status: h.status,
        score: h.score,
        submittedAt: h.submittedAt?.toISOString() ?? null,
        timeTakenSec: h.timeTakenSec,
      }))}
    />
  );
}
