import { BadgeCheck, Briefcase, EyeOff, GraduationCap, Lock, MapPin, Stamp, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FadeIn } from "@/components/motion";
import { EvidenceCard } from "@/components/profile/evidence-card";
import { KIND_META, KIND_ORDER } from "@/components/profile/kind-meta";
import { ScoreBreakdownPanel } from "@/components/profile/score-breakdown";
import { ScoreRing } from "@/components/profile/score-ring";
import { PassArrival } from "@/components/profile/pass/pass-arrival";
import { ProofPass } from "@/components/profile/pass/proof-pass";
import { ProofReplay } from "@/components/profile/proof-replay";
import { buildPassQr, renderPassQrSvg } from "@/components/profile/pass/qr";
import { SkillConstellation } from "@/components/profile/skill-constellation";
import { WorkTimeline } from "@/components/profile/work-timeline";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Seal } from "@/components/ui/seal";
import { SealGlyph } from "@/components/ui/seal-glyph";
import { getCurrentUser } from "@/server/auth/guard";
import { getDossier, getShareCard } from "@/server/public/queries";
import { getOrigin } from "@/server/public/site";
import { getProofReplay } from "@/server/scoring";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  // Only public profiles reveal a name to crawlers and link previews.
  const card = await getShareCard(handle);
  if (!card) return { title: "Proof profile", robots: { index: false } };
  const description = `${card.seals} verified evidence items · Proof Score ${card.score}${card.headline ? ` · ${card.headline}` : ""}`;
  return {
    title: `${card.name} (@${card.handle})`,
    description,
    openGraph: { title: `${card.name} · verified on Proof`, description, type: "profile" },
    twitter: { card: "summary_large_image", title: `${card.name} · verified on Proof`, description },
  };
}

export default async function DossierPage({ params }: Props) {
  const { handle } = await params;
  const viewer = await getCurrentUser();
  const result = await getDossier(handle, viewer ? { id: viewer.id, role: viewer.role } : null);
  if (result.status === "not_found") notFound();

  if (result.status === "restricted") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-20 sm:px-6">
        <EmptyState
          icon={Lock}
          title="This dossier is for recruiters"
          description="The student shares their verified evidence with signed-in recruiters and placement officers only."
          action={
            <Button asChild variant="secondary">
              <Link href={`/login?next=/u/${encodeURIComponent(handle)}`}>Sign in to view</Link>
            </Button>
          }
        />
      </main>
    );
  }

  const { profile, score, skills, evidence, timeline, sealCount, credentialCount, isOwner } = result;
  const [origin, replay] = await Promise.all([getOrigin(), evidence.length ? getProofReplay(profile.userId) : null]);
  const url = `${origin}/u/${profile.handle}`;
  const passUrl = `${url}?via=pass`;
  const passQr = renderPassQrSvg(buildPassQr(passUrl), { id: "pp", animate: true });
  const skillNames = new Map(skills.map((s) => [s.slug, s.name]));
  const kindCounts = KIND_ORDER.map((k) => ({ kind: k, n: evidence.filter((e) => e.kind === k).length })).filter((k) => k.n > 0);

  return (
    <main className="pb-24">
      <PassArrival handle={profile.handle} sealCount={sealCount} />
      {isOwner && profile.visibility !== "public" && (
        <div className="border-b border-line bg-violet-soft/60 text-sm">
          <p className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5 text-violet-text sm:px-6">
            {profile.visibility === "hidden" ? <EyeOff className="size-4" aria-hidden /> : <Users className="size-4" aria-hidden />}
            {profile.visibility === "hidden"
              ? "Only you can see this dossier. Everyone else gets a 404."
              : "Visible to signed-in recruiters and placement officers only."}
          </p>
        </div>
      )}

      {/* Header */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 bg-dots opacity-50 [mask-image:radial-gradient(60%_80%_at_80%_0%,black,transparent)]" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 pt-10 pb-10 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-end lg:pt-14">
          <FadeIn className="min-w-0">
            <p className="font-mono text-[11px] tracking-[0.16em] text-subtle uppercase">Verified dossier · @{profile.handle}</p>
            <div className="mt-4 flex items-start gap-4 sm:items-center sm:gap-5">
              <Avatar name={profile.name} src={profile.image} size="xl" verified={sealCount > 0} />
              <div className="min-w-0">
                <h1 className="text-[2rem] leading-[1.05] font-semibold tracking-[-0.03em] text-balance sm:text-5xl">{profile.name}</h1>
                {profile.headline && <p className="mt-2 max-w-2xl text-pretty text-muted sm:text-lg">{profile.headline}</p>}
              </div>
            </div>
            <ul className="mt-6 flex flex-wrap gap-2">
              {profile.college && (
                <li>
                  <Badge variant="outline" className="py-1">
                    <GraduationCap /> {profile.college.name}
                    {profile.college.domainVerified && <SealGlyph className="text-verified" aria-label="Domain verified" />}
                  </Badge>
                </li>
              )}
              {(profile.degree || profile.graduationYear) && (
                <li>
                  <Badge variant="neutral" className="py-1">
                    {[profile.degree, profile.branch].filter(Boolean).join(" ")}
                    {profile.graduationYear ? ` · Class of ${profile.graduationYear}` : ""}
                  </Badge>
                </li>
              )}
              {profile.location && (
                <li>
                  <Badge variant="neutral" className="py-1">
                    <MapPin /> {profile.location}
                  </Badge>
                </li>
              )}
              {profile.openToWork && (
                <li>
                  <Badge variant="violet" className="py-1">
                    <Briefcase /> Open to {profile.targetRoles[0]?.toLowerCase() ?? "work"} roles
                  </Badge>
                </li>
              )}
            </ul>
          </FadeIn>

          <FadeIn delay={0.1} className="flex items-center gap-5 sm:gap-7 lg:pr-3">
            <ScoreRing score={score.overall} size={128} />
            <div className="flex shrink-0 flex-col items-center">
              {/* Drops in from 1.5x (not the default 2.4x) so the stamp stays inside the header at every width. */}
              <Seal size={96} stamp="mount" stampFrom={1.5} delay={0.5} label={`${sealCount} seals · verified ·`} title={`${sealCount} verified evidence items`} />
              <p className="mt-2 text-center">
                <span className="font-display text-2xl font-semibold tabular">{sealCount}</span>{" "}
                <span className="text-sm text-muted">{sealCount === 1 ? "seal" : "seals"}</span>
              </p>
            </div>
          </FadeIn>
        </div>

        {kindCounts.length > 0 && (
          <div className="relative border-t border-line bg-surface/70">
            <ul className="mx-auto flex max-w-6xl gap-x-8 gap-y-2 overflow-x-auto px-4 py-3.5 text-sm sm:px-6" aria-label="Evidence by kind">
              {kindCounts.map(({ kind, n }) => {
                const Icon = KIND_META[kind].icon;
                return (
                  <li key={kind} className="flex shrink-0 items-center gap-2">
                    <Icon className="size-4 text-verified" aria-hidden />
                    <span className="font-mono tabular">{n}</span>
                    <span className="text-muted">{KIND_META[kind].label.toLowerCase()}</span>
                  </li>
                );
              })}
              <li className="flex shrink-0 items-center gap-2">
                <BadgeCheck className="size-4 text-verified" aria-hidden />
                <span className="font-mono tabular">{credentialCount}</span>
                <span className="text-muted">signed credentials</span>
              </li>
            </ul>
          </div>
        )}
      </section>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {evidence.length === 0 ? (
          <EmptyState
            className="mt-12"
            icon={Stamp}
            title="No verified evidence yet"
            description="Seals appear here as GitHub ownership, code authorship, live deployments, skill checks and mentor endorsements are verified."
          />
        ) : (
          <>
            {/* Constellation */}
            <section aria-labelledby="constellation-h" className="mt-12">
              <SectionHeading id="constellation-h" eyebrow="Skill constellation" title="Every star is a piece of evidence." />
              <div className="mt-5">
                <SkillConstellation skills={skills} evidence={evidence} />
              </div>
            </section>

            {/* Evidence */}
            <section aria-labelledby="evidence-h" className="mt-16">
              <SectionHeading id="evidence-h" eyebrow={`${sealCount} sealed items`} title="Evidence, with receipts." />
              <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {evidence.map((ev) => (
                  <li key={ev.id}>
                    <EvidenceCard ev={ev} skillNames={skillNames} pinned={ev.pinned} />
                  </li>
                ))}
              </ul>
            </section>

            {/* Replay */}
            {replay && replay.weeks.length > 1 && (
              <section aria-labelledby="replay-h" className="mt-16">
                <SectionHeading id="replay-h" eyebrow={`Proof Replay · ${replay.weeks.length} weeks`} title="Watch the work add up." />
                <div className="mt-6">
                  <ProofReplay replay={replay} />
                </div>
              </section>
            )}
          </>
        )}

        <div className="mt-16 grid gap-10 lg:grid-cols-[1fr_22rem]">
          <section aria-labelledby="timeline-h">
            <SectionHeading id="timeline-h" eyebrow="Work timeline" title="When the work happened." />
            <div className="mt-6">
              {timeline.length ? <WorkTimeline entries={timeline} /> : <p className="text-sm text-muted">No dated work yet.</p>}
            </div>
          </section>

          <aside className="grid content-start gap-5">
            <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card">
              <p className="font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">Why {score.overall}?</p>
              <div className="mt-4">
                <ScoreBreakdownPanel score={score.overall} breakdown={score.breakdown} caps={score.caps} explanation={score.explanation} />
              </div>
            </div>
            {skills.length > 0 && (
              <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card">
                <p className="font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">Skill scores</p>
                <ul className="mt-4 grid gap-3">
                  {skills.slice(0, 8).map((s) => (
                    <li key={s.slug} className="grid gap-1">
                      <div className="flex justify-between text-sm">
                        <span>{s.name}</span>
                        <span className="font-mono text-muted tabular">{s.score}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-lime" style={{ width: `${s.score}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {profile.about && (
              <div className="rounded-[var(--radius-card)] border border-line bg-surface bg-ledger p-5 shadow-card">
                <p className="font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">About</p>
                <p className="mt-3 text-sm leading-relaxed text-pretty">{profile.about}</p>
              </div>
            )}
            <section aria-labelledby="pass-h" className="grid gap-3">
              <p id="pass-h" className="font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">
                Proof Pass · share
              </p>
              <ProofPass
                name={profile.name}
                handle={profile.handle}
                score={score.overall}
                sealCount={sealCount}
                skills={skills.slice(0, 3).map((s) => s.name)}
                college={profile.college?.shortName ?? profile.college?.name ?? null}
                url={url}
                passUrl={passUrl}
                qrSvg={passQr}
                passImage={profile.visibility === "public" ? `/u/${profile.handle}/pass` : null}
              />
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function SectionHeading({ id, eyebrow, title }: { id: string; eyebrow: string; title: string }) {
  return (
    <div>
      <p className="font-mono text-[11px] tracking-[0.16em] text-subtle uppercase">{eyebrow}</p>
      <h2 id={id} className="mt-2 text-2xl font-semibold text-balance sm:text-3xl">
        {title}
      </h2>
    </div>
  );
}
