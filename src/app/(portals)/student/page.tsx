import { BadgeCheck, Briefcase, Code2, GitBranch, Globe, Palette, ShieldCheck, Sparkles, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { RoadmapCard } from "@/components/shell/roadmap-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { requireRole } from "@/server/auth/guard";
import { getStudentDashboard } from "@/server/student/queries";

export const metadata: Metadata = { title: "Student dashboard" };

export default async function StudentDashboard() {
  const user = await requireRole("student", "/student");
  const data = await getStudentDashboard(user.id);
  const first = user.name.split(" ")[0];

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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Proof Score" value={data.profile?.proofScore ?? 0} tone="verified" icon={ShieldCheck} hint="0-100, explained" />
        <Stat label="Verified evidence" value={data.verifiedEvidence} icon={BadgeCheck} />
        <Stat label="Applications" value={data.applications} icon={Briefcase} />
        <Stat label="Grad year" value={data.profile?.graduationYear ?? "—"} icon={Sparkles} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <RoadmapCard
          title="What lives here"
          description="The student portal turns real work into evidence recruiters can trust."
          items={[
            { icon: GitBranch, title: "Connect GitHub", description: "Prove ownership with a proof.md gist, then import repos for authorship analysis." },
            { icon: Globe, title: "Live deployments", description: "Verify a URL with a meta tag or /.well-known/proof.txt and track its health." },
            { icon: Code2, title: "Skill checks", description: "Timed coding tasks graded server-side in a sandbox against hidden tests." },
            { icon: Users, title: "Mentor endorsements", description: "Ask a verified professor or senior to vouch for a specific skill or project." },
            { icon: Palette, title: "Profile builder", description: "Headline, pinned evidence, accent colour and privacy controls." },
            { icon: Briefcase, title: "Jobs & applications", description: "Apply with your evidence and track every stage." },
          ]}
        />
        <Card>
          <CardHeader>
            <CardTitle>Top verified skills</CardTitle>
            <CardDescription>Per-skill Proof Score.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.topSkills.length === 0 ? (
              <EmptyState
                className="py-8"
                title="No scored skills yet"
                description="Connect GitHub or take a skill check to earn your first score."
              />
            ) : (
              <ul className="grid gap-3">
                {data.topSkills.map((s) => (
                  <li key={s.slug} className="grid gap-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{s.name}</span>
                      <Badge variant={s.score >= 70 ? "verified" : "neutral"} mono>
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
