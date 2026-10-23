import { Lock, MapPin, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Seal } from "@/components/ui/seal";
import { getCurrentUser } from "@/server/auth/guard";
import { getPublicProfile } from "@/server/public/queries";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  return { title: `@${handle}` };
}

/** Placeholder dossier. The full "verified dossier" (constellation, timeline, evidence seals) comes next. */
export default async function PublicProfilePage({ params }: Props) {
  const { handle } = await params;
  const viewer = await getCurrentUser();
  const result = await getPublicProfile(handle, viewer ? { id: viewer.id, role: viewer.role } : null);
  if (!result) notFound();

  if (result.restricted) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={Lock}
          title="This profile is not public"
          description="The student has limited their Proof profile to signed-in recruiters, or hidden it."
        />
      </main>
    );
  }

  const { profile, topSkills } = result;
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Card variant="ledger" className="overflow-hidden">
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
          <Avatar name={profile.user.name} src={profile.user.image} size="xl" verified={profile.proofScore >= 50} />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs text-subtle">@{profile.handle}</p>
            <h1 className="mt-1 text-3xl font-semibold">{profile.user.name}</h1>
            {profile.headline && <p className="mt-1 text-muted">{profile.headline}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.college && (
                <Badge variant="outline">
                  <MapPin /> {profile.college.name}
                </Badge>
              )}
              {profile.graduationYear && <Badge variant="neutral">Class of {profile.graduationYear}</Badge>}
            </div>
          </div>
          <div className="flex items-center gap-4 sm:flex-col sm:items-end">
            <Seal size={84} stamp="mount" delay={0.25} />
            <div className="text-right">
              <p className="font-mono text-[11px] tracking-wider text-subtle uppercase">Proof Score</p>
              <p className="font-display text-4xl font-semibold tabular text-verified">{profile.proofScore}</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_16rem]">
        <Card>
          <CardHeader>
            <CardTitle>Verified skills</CardTitle>
          </CardHeader>
          <CardContent>
            {topSkills.length === 0 ? (
              <p className="text-sm text-muted">No verified skills yet.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {topSkills.map((s) => (
                  <li key={s.slug}>
                    <Badge variant={s.score >= 70 ? "verified" : "neutral"}>
                      {s.name} <span className="font-mono">{s.score}</span>
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card variant="ghost" className="p-5">
          <Sparkles className="size-4 text-violet-text" aria-hidden />
          <p className="mt-3 text-sm font-medium">The full dossier is coming</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Skill constellation, work timeline and evidence cards with seals.
          </p>
        </Card>
      </div>
    </main>
  );
}
