import { ArrowRight, BadgeCheck, Briefcase, Code2, FileCheck2, GitBranch, Globe, Sparkles, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FadeIn } from "@/components/motion/fade-in";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SealGlyph } from "@/components/ui/seal-glyph";
import { Stat } from "@/components/ui/stat";
import { timeAgo } from "@/lib/utils";
import { requireRole } from "@/server/auth/guard";
import { getStudentDashboard } from "@/server/student/queries";
import { ScoreDial, WhyDrawer } from "./_components/score-panel";

export const metadata: Metadata = { title: "Student dashboard" };

const KIND_ICON = {
  github_ownership: GitBranch,
  repo_authorship: GitBranch,
  deployment: Globe,
  skill_check: Code2,
  attestation: Users,
} as const;

const NEXT_ICON = { github: GitBranch, authorship: GitBranch, deployments: Globe, checks: Code2, endorsements: Users, recency: Sparkles } as const;

export default async function StudentDashboard() {
  const user = await requireRole("student", "/student");
  const data = await getStudentDashboard(user.id);
  if (data.profile && data.profile.onboardingStep < 4 && user.role === "student") redirect("/student/onboarding");
  const first = user.name.split(" ")[0];
  const score = data.profile?.proofScore ?? 0;
  const [best, ...rest] = data.next;

  return (
    <>
      <PageHeader
        eyebrow={data.profile?.college ? data.profile.college.name : "Student portal"}
        title={`Welcome back, ${first}`}
        description="Your dossier of verified work. Every number below comes from evidence, never from a claim."
        actions={
          data.profile && (
            <Button variant="secondary" asChild>
              <Link href={`/u/${data.profile.handle}`}>View public profile</Link>
            </Button>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <FadeIn>
          <Card variant="ledger" className="overflow-hidden">
            <div className="grid items-center gap-6 p-5 sm:grid-cols-[auto_1fr] sm:p-6">
              <div className="mx-auto">
                <ScoreDial score={score} />
              </div>
              <div className="min-w-0">
                <p className="font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">Proof Score</p>
                <h2 className="mt-1 font-display text-2xl font-semibold text-balance">
                  {score >= 75 ? "Recruiter-ready evidence" : score >= 45 ? "Solid, and climbing" : score > 0 ? "A real start" : "Let's prove your first skill"}
                </h2>
                <p className="mt-2 text-sm text-pretty text-muted">
                  Weighted from {data.verifiedEvidence} verified item{data.verifiedEvidence === 1 ? "" : "s"}: authorship, live sites, skill checks and
                  mentor endorsements. Open the breakdown to see every point.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <WhyDrawer score={score} breakdown={data.breakdown} skills={data.topSkills} />
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/student/proofs">
                      Proofs hub <ArrowRight />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 border-t border-line sm:grid-cols-4">
              {[
                { label: "Repos", value: data.counts.repos, icon: GitBranch },
                { label: "Live sites", value: data.counts.deployments, icon: Globe },
                { label: "Checks passed", value: data.counts.checks, icon: Code2 },
                { label: "Endorsements", value: data.counts.endorsements, icon: Users },
              ].map((s, i) => (
                <div key={s.label} className={`flex items-center gap-3 p-4 ${i % 2 === 1 ? "border-l" : ""} ${i >= 2 ? "border-t sm:border-t-0" : ""} ${i === 2 ? "sm:border-l" : ""} border-line`}>
                  <s.icon className="size-4 text-subtle" aria-hidden />
                  <div>
                    <div className="font-display text-xl font-semibold tabular">{s.value}</div>
                    <div className="text-xs text-muted">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </FadeIn>

        <FadeIn delay={0.08}>
          {best ? (
            <Card variant="verified" className="h-full">
              <CardHeader>
                <p className="font-mono text-[11px] tracking-[0.14em] text-verified uppercase">Next best proof</p>
                <CardTitle className="text-xl">{best.title}</CardTitle>
                <CardDescription>{best.description}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="flex items-center justify-between gap-3">
                  <Badge variant="verified" mono>
                    up to +{best.potential}
                  </Badge>
                  <Button asChild size="sm">
                    <Link href={best.href}>
                      Start <ArrowRight />
                    </Link>
                  </Button>
                </div>
                {rest.length > 0 && (
                  <ul className="grid gap-1 border-t border-line pt-3">
                    {rest.slice(0, 3).map((n) => {
                      const Icon = NEXT_ICON[n.signal];
                      return (
                        <li key={n.signal}>
                          <Link href={n.href} className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-surface-2">
                            <Icon className="size-4 text-subtle" aria-hidden />
                            <span className="flex-1 truncate">{n.title}</span>
                            <span className="font-mono text-xs text-subtle">+{n.potential}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card variant="verified" className="h-full">
              <CardHeader>
                <CardTitle>Every signal maxed</CardTitle>
                <CardDescription>Keep shipping: recency keeps your score fresh.</CardDescription>
              </CardHeader>
            </Card>
          )}
        </FadeIn>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Verified evidence" value={data.verifiedEvidence} icon={BadgeCheck} tone="verified" />
        <Stat label="Applications" value={data.applications} icon={Briefcase} hint={`${data.activeApplications} active`} />
        <Stat label="Interviews & offers" value={data.interviews} icon={Sparkles} />
        <Stat label="Grad year" value={data.profile?.graduationYear ?? "—"} icon={FileCheck2} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Recently verified</CardTitle>
              <CardDescription>Each item is a signed credential anyone can check.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {data.recent.length === 0 ? (
              <EmptyState
                className="py-8"
                icon={BadgeCheck}
                title="No verified evidence yet"
                description="Prove your GitHub, verify a live site or pass a skill check. It stamps here."
                action={
                  <Button asChild size="sm">
                    <Link href="/student/proofs">Open the proofs hub</Link>
                  </Button>
                }
              />
            ) : (
              <Stagger className="grid divide-y divide-line">
                {data.recent.map((e) => {
                  const Icon = KIND_ICON[e.kind];
                  return (
                    <StaggerItem key={e.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-surface-2">
                        <Icon className="size-4 text-muted" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-sm font-medium">
                          <SealGlyph className="size-3.5 shrink-0 text-verified" />
                          <span className="truncate">{e.title}</span>
                        </p>
                        {e.summary && <p className="truncate text-xs text-muted">{e.summary}</p>}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-xs text-subtle">{timeAgo(e.verifiedAt)}</span>
                        {e.credentialId && (
                          <Link href={`/verify/${e.credentialId}`} className="font-mono text-[11px] text-violet-text hover:underline">
                            credential
                          </Link>
                        )}
                      </div>
                    </StaggerItem>
                  );
                })}
              </Stagger>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top verified skills</CardTitle>
            <CardDescription>Per-skill Proof Score from tagged evidence.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.topSkills.filter((s) => s.score > 0).length === 0 ? (
              <EmptyState className="py-8" title="No scored skills yet" description="Connect GitHub or take a skill check to earn your first score." />
            ) : (
              <ul className="grid gap-3">
                {data.topSkills
                  .filter((s) => s.score > 0)
                  .slice(0, 6)
                  .map((s) => (
                    <li key={s.slug} className="grid gap-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{s.name}</span>
                        <Badge variant={s.score >= 60 ? "verified" : "neutral"} mono>
                          {s.score}
                        </Badge>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-lime" style={{ width: `${s.score}%` }} />
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
