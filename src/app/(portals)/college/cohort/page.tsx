import { BarChart3, Bell, Filter, Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { requireRole } from "@/server/auth/guard";
import { READY_SCORE, getCohortAnalytics, getCollege } from "@/server/college/queries";
import { collegeScopeOf } from "@/server/college/scope";
import { ReadinessFunnel, SkillDistribution, SkillGaps } from "../_components/charts";
import { NoCollege } from "../_components/no-college";

export const metadata: Metadata = { title: "Cohort" };

export default async function CohortPage() {
  const user = await requireRole("college", "/college/cohort");
  const scope = collegeScopeOf(user);
  if (!scope) {
    return (
      <>
        <PageHeader eyebrow="Placement cell" title="Cohort" />
        <NoCollege />
      </>
    );
  }
  const [college, a] = await Promise.all([getCollege(scope), getCohortAnalytics(scope)]);
  const ready = a.funnel.at(-1)?.n ?? 0;
  const incomplete = a.students.filter((s) => s.gaps.length >= 3).length;
  const avg = a.total ? Math.round(a.students.reduce((x, s) => x + s.proofScore, 0) / a.total) : 0;

  return (
    <>
      <PageHeader
        eyebrow={college?.shortName ?? "Placement cell"}
        title="Cohort readiness"
        description="Built only from verified evidence. A student counts toward a skill when a commit, deployment, check or endorsement backs it."
        actions={
          <Button variant="secondary" asChild>
            <Link href="/college/nudges">
              <Bell /> Nudge {incomplete} students
            </Link>
          </Button>
        }
      />
      {a.total === 0 ? (
        <EmptyState icon={BarChart3} title="No students yet" description="Students who sign up with your college appear here as they add evidence." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Students" value={a.total} />
            <Stat label="Avg Proof Score" value={avg} icon={Target} />
            <Stat label={`Job-ready (${READY_SCORE}+)`} value={ready} tone="verified" hint={`${Math.round((ready / a.total) * 100)}% of cohort`} />
            <Stat label="3+ proofs missing" value={incomplete} icon={Filter} hint="worth a nudge" />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Verified skill distribution</CardTitle>
                <CardDescription>Students with evidence per skill. Self-reported skills do not count.</CardDescription>
              </CardHeader>
              <CardContent>
                {a.distribution.length ? (
                  <SkillDistribution rows={a.distribution.slice(0, 10)} total={a.total} />
                ) : (
                  <p className="text-sm text-muted">No verified skills yet.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Readiness funnel</CardTitle>
                <CardDescription>How far students have taken their proofs.</CardDescription>
              </CardHeader>
              <CardContent>
                <ReadinessFunnel steps={a.funnel} />
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Top skill gaps</CardTitle>
              <CardDescription>What open roles on Proof require, against how many of your students already meet that bar.</CardDescription>
            </CardHeader>
            <CardContent>
              {a.gaps.length ? <SkillGaps gaps={a.gaps} total={a.total} /> : <p className="text-sm text-muted">No open roles list required skills right now.</p>}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
