import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  ClipboardCheck,
  ExternalLink,
  GitBranch,
  Globe,
  MapPin,
  Quote,
  ShieldCheck,
  UserX,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SealGlyph } from "@/components/ui/seal-glyph";
import { cn, timeAgo } from "@/lib/utils";
import { PIPELINE_STAGE_LABEL } from "@/lib/validation/recruiter";
import { CandidateStoryCard } from "@/components/recruiter/candidate-story";
import { InterviewKitPreview } from "@/components/recruiter/interview-kit";
import { ContactUnlockCard } from "@/components/billing/contact-unlock";
import { requireRole } from "@/server/auth/guard";
import { getContactUnlock } from "@/server/billing/queries";
import { getStripe } from "@/server/billing/stripe";
import { buildCandidateStory } from "@/server/recruiter/candidate-story";
import { buildInterviewKit, kitInputFrom } from "@/server/recruiter/interview-kit";
import { getCandidate, getJobForStory, getJobOptions, getPublishedChecks, getShortlistOptions } from "@/server/recruiter/queries";
import { recruiterScopeOf } from "@/server/recruiter/scope";
import { ScoreRing } from "../../_components/score-ring";
import { CandidateActions } from "./candidate-actions";

export const metadata: Metadata = { title: "Candidate" };

const FLAG_COPY: Record<string, string> = {
  all_commits_one_day: "All commits landed on one day",
  bulk_import: "History looks bulk-imported",
  backdated_history: "Repo is newer than its commits",
};

function fmtSec(s: number | null) {
  if (!s) return "n/a";
  const m = Math.round(s / 60);
  return m < 1 ? `${s}s` : `${m} min`;
}

export default async function CandidatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const jobParam = (await searchParams).job;
  const user = await requireRole("recruiter", `/recruiter/candidates/${id}`);
  const scope = recruiterScopeOf(user);
  const c = await getCandidate(scope, id);

  if (!c) {
    return (
      <EmptyState
        icon={UserX}
        title="This profile is not available"
        description="The student may have hidden their profile from recruiters. Hidden profiles never appear in search or here."
        action={
          <Button variant="secondary" asChild>
            <Link href="/recruiter/search">Back to search</Link>
          </Button>
        }
      />
    );
  }

  const [jobs, lists, checks, storyJob] = scope
    ? await Promise.all([
        getJobOptions(scope),
        getShortlistOptions(scope),
        getPublishedChecks(),
        typeof jobParam === "string" && jobParam.length <= 64 ? getJobForStory(scope, jobParam) : Promise.resolve(null),
      ])
    : [[], [], [], null];
  const contact = scope ? await getContactUnlock({ type: "company", id: scope.companyId }, c.user.id) : null;
  const billingMode = getStripe() ? "stripe" : "demo";
  const story = buildCandidateStory(
    {
      firstName: c.user.name.split(" ")[0] || c.user.name,
      proofScore: c.profile.proofScore,
      skills: c.skills,
      repos: c.repos,
      deployments: c.deployments,
      attempts: c.attempts,
      attestations: c.attestations,
    },
    storyJob,
  );
  const kit = buildInterviewKit(kitInputFrom(c));
  const b = c.profile.scoreBreakdown;
  const parts = b
    ? [
        { label: "Authorship", value: b.authorship, max: 35 },
        { label: "Deployments", value: b.deployments, max: 20 },
        { label: "Skill checks", value: b.checks, max: 25 },
        { label: "Endorsements", value: b.endorsements, max: 20 },
        { label: "Recency", value: b.recency, max: 10 },
      ]
    : [];
  const liveDeploys = c.deployments.filter((d) => d.status === "verified");

  return (
    <>
      <Link href="/recruiter/search" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Search
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid min-w-0 gap-6">
          {/* Dossier header */}
          <Card variant="ledger" className="overflow-hidden">
            <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:p-6">
              <Avatar name={c.user.name} src={c.user.image} size="xl" verified={c.github?.status === "verified"} />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">Evidence dossier</p>
                <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">{c.user.name}</h1>
                {c.profile.headline && <p className="mt-1 text-pretty text-muted">{c.profile.headline}</p>}
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-subtle">
                  {c.college && <span>{c.college.name}</span>}
                  {c.profile.graduationYear && <span className="font-mono">Class of {c.profile.graduationYear}</span>}
                  {c.profile.branch && <span>{c.profile.branch}</span>}
                  {c.profile.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" aria-hidden /> {c.profile.location}
                    </span>
                  )}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.github?.status === "verified" && <Badge variant="verified">github.com/{c.github.username}</Badge>}
                  {c.profile.openToWork && <Badge variant="violet">Open to work</Badge>}
                  {c.profile.visibility === "hidden" && <Badge variant="coral">Hidden: visible because they applied</Badge>}
                  {c.profile.visibility === "public" && (
                    <Badge variant="outline">
                      <Link href={`/u/${c.profile.handle}`} className="hover:underline">
                        /u/{c.profile.handle}
                      </Link>
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                <ScoreRing score={c.profile.proofScore} size={88} />
              </div>
            </div>
            {parts.length > 0 && (
              <div id="evidence-score" className="scroll-mt-24 border-t border-line bg-surface/70 px-5 py-4 sm:px-6">
                <p className="mb-3 font-mono text-[11px] tracking-wider text-subtle uppercase">Why {c.profile.proofScore}?</p>
                <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
                  {parts.map((p) => (
                    <div key={p.label} className="grid grid-cols-[7rem_minmax(0,1fr)_2.5rem] items-center gap-3 text-sm">
                      <span className="text-muted">{p.label}</span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                        <span className="block h-full rounded-full bg-lime" style={{ width: `${Math.min(100, (p.value / p.max) * 100)}%` }} />
                      </span>
                      <span className="text-right font-mono text-xs tabular">
                        {p.value}/{p.max}
                      </span>
                    </div>
                  ))}
                </div>
                {b && b.reasons.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                    {b.reasons.map((r) => (
                      <li key={r} className="inline-flex items-center gap-1.5">
                        <SealGlyph className="size-3 text-lime" /> {r}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Card>

          <CandidateStoryCard
            story={story}
            candidateId={c.user.id}
            job={storyJob ? { id: storyJob.id, title: storyJob.title } : null}
            jobs={jobs.filter((j) => j.status !== "closed")}
          />

          <InterviewKitPreview kit={kit} candidateId={c.user.id} firstName={c.user.name.split(" ")[0] || c.user.name} />

          {/* Verified skills */}
          <Card id="evidence-skills" className="scroll-mt-24">
            <CardHeader>
              <CardTitle>Verified skills</CardTitle>
            </CardHeader>
            <CardContent>
              {c.skills.length === 0 ? (
                <p className="text-sm text-muted">No skill is backed by verified evidence yet.</p>
              ) : (
                <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                  {c.skills.map((s) => (
                    <li key={s.slug} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                      <span className="truncate text-sm font-medium">{s.name}</span>
                      <span className="font-mono text-xs text-muted tabular">
                        {s.score} · {s.evidenceCount} proof{s.evidenceCount === 1 ? "" : "s"}
                      </span>
                      <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
                        <span
                          className={cn("block h-full rounded-full", s.score >= 70 ? "bg-lime" : "bg-violet")}
                          style={{ width: `${s.score}%` }}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Code authorship */}
          <EvidenceSection id="evidence-repos" icon={GitBranch} title="Code they wrote" count={c.repos.length} empty="No repositories imported yet.">
            {c.repos.map((r) => {
              const flags = r.redFlags ?? [];
              return (
                <li key={r.id} className="grid gap-2 py-3.5 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1.5 font-mono text-sm font-medium hover:underline">
                      <span className="truncate">{r.fullName}</span>
                      <ExternalLink className="size-3.5 shrink-0 text-subtle" aria-hidden />
                    </a>
                    {r.status === "verified" ? <Badge variant="verified">Authorship verified</Badge> : <Badge variant="coral">Under review</Badge>}
                  </div>
                  {r.description && <p className="text-sm text-muted">{r.description}</p>}
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                    <Fact label="Own commits" value={`${r.ownCommits ?? 0} / ${r.totalCommits ?? 0}`} />
                    <Fact label="Authorship" value={`${Math.round((r.share ?? 0) * 100)}%`} />
                    <Fact label="Active weeks" value={String(r.activeWeeks ?? 0)} />
                    <Fact label="Language" value={r.language ?? "n/a"} />
                  </dl>
                  <span className="h-1 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                    <span className="block h-full rounded-full bg-lime" style={{ width: `${Math.round((r.share ?? 0) * 100)}%` }} />
                  </span>
                  {flags.length > 0 && (
                    <p className="inline-flex items-center gap-1.5 text-xs text-coral-text">
                      <AlertTriangle className="size-3.5" aria-hidden />
                      {flags.map((f) => FLAG_COPY[f] ?? f).join(" · ")}
                    </p>
                  )}
                </li>
              );
            })}
          </EvidenceSection>

          {/* Deployments */}
          <EvidenceSection id="evidence-deployments" icon={Globe} title="Live deployments" count={liveDeploys.length} empty="No live deployment verified yet.">
            {c.deployments.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <a href={d.url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1.5 font-mono text-sm hover:underline">
                    <span className="truncate">{d.url.replace(/^https?:\/\//, "")}</span>
                    <ExternalLink className="size-3.5 shrink-0 text-subtle" aria-hidden />
                  </a>
                  <p className="mt-0.5 text-xs text-subtle">
                    Proved by {d.method === "well_known" ? "/.well-known/proof.txt" : "meta tag"}
                    {d.homepageMatchesRepo && " · matches repo homepage"}
                    {d.lastCheckedAt && ` · checked ${timeAgo(d.lastCheckedAt)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {d.lastStatusCode && (
                    <span className={cn("font-mono text-xs", d.lastStatusCode < 400 ? "text-verified" : "text-coral-text")}>
                      {d.lastStatusCode} · {d.lastResponseMs}ms
                    </span>
                  )}
                  {d.status === "verified" ? <Badge variant="verified">Live</Badge> : <Badge variant="coral">{d.status}</Badge>}
                </div>
              </li>
            ))}
          </EvidenceSection>

          {/* Skill checks */}
          <EvidenceSection id="evidence-checks" icon={ClipboardCheck} title="Skill checks" count={c.attempts.filter((a) => a.status === "passed").length} empty="No skill checks taken yet.">
            {c.attempts.map((a) => (
              <li key={a.id} className="grid gap-1.5 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {a.title} <span className="font-normal text-subtle">· {a.level}</span>
                  </p>
                  {a.status === "passed" ? (
                    <Badge variant="verified">Passed {a.score}</Badge>
                  ) : a.status === "invited" ? (
                    <Badge variant="violet">Invited</Badge>
                  ) : (
                    <Badge>{a.status.replace("_", " ")}{a.score != null ? ` ${a.score}` : ""}</Badge>
                  )}
                </div>
                {a.status !== "invited" && (
                  <p className="text-xs text-muted">
                    {a.passedTests}/{a.totalTests} hidden tests · {fmtSec(a.timeTakenSec)} · {a.pasteEvents} paste event{a.pasteEvents === 1 ? "" : "s"} · {a.tabBlurs} tab switch{a.tabBlurs === 1 ? "" : "es"}
                    <span className="text-subtle"> (signals shown, never auto-penalised)</span>
                  </p>
                )}
              </li>
            ))}
          </EvidenceSection>

          {/* Endorsements */}
          <EvidenceSection id="evidence-endorsements" icon={ShieldCheck} title="Mentor endorsements" count={c.attestations.length} empty="No endorsements yet.">
            {c.attestations.map((a) => (
              <li key={a.id} className="py-3.5 first:pt-0 last:pb-0">
                <figure className="relative rounded-xl border border-line bg-surface-2/60 p-4">
                  <Quote className="absolute top-3 right-3 size-4 text-subtle" aria-hidden />
                  {a.statement && <blockquote className="pr-6 text-sm leading-relaxed text-pretty">“{a.statement}”</blockquote>}
                  <figcaption className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-medium">{a.mentorName}</span>
                    <span className="text-muted">{a.mentorTitle}</span>
                    {a.domainVerifiedAt ? (
                      <Badge variant="verified">Verified mentor at @{a.domain}</Badge>
                    ) : (
                      <Badge>Domain unverified</Badge>
                    )}
                    {a.skillName && <Badge variant="outline">{a.skillName}</Badge>}
                  </figcaption>
                </figure>
              </li>
            ))}
          </EvidenceSection>

          {/* Ledger */}
          <Card variant="ledger">
            <CardHeader>
              <CardTitle>Evidence ledger</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative grid gap-3 border-l border-line pl-5">
                {c.evidence.map((e) => (
                  <li key={e.id} className="relative">
                    <SealGlyph className="absolute top-0.5 -left-[1.7rem] size-4 text-lime" />
                    <p className="text-sm font-medium">{e.title}</p>
                    <p className="text-xs text-muted">
                      {e.summary ? `${e.summary} · ` : ""}
                      {e.verifiedAt ? `verified ${timeAgo(e.verifiedAt)}` : ""}
                      {e.credentialId && (
                        <>
                          {" · "}
                          <Link href={`/verify/${e.credentialId}`} className="text-violet-text hover:underline">
                            credential
                          </Link>
                        </>
                      )}
                    </p>
                  </li>
                ))}
                {c.evidence.length === 0 && <li className="text-sm text-muted">Nothing verified yet.</li>}
              </ol>
            </CardContent>
          </Card>
        </div>

        <aside className="grid content-start gap-4 lg:sticky lg:top-20 lg:self-start">
          {scope && c.context ? (
            <>
              {(c.context.cards.length > 0 || c.context.applications.length > 0) && (
                <Card variant="flat" className="p-4">
                  <p className="mb-2 font-mono text-[11px] tracking-wider text-subtle uppercase">With your team</p>
                  <ul className="grid gap-1.5 text-sm">
                    {c.context.cards.map((card) => (
                      <li key={card.id} className="flex items-center justify-between gap-2">
                        <span className="truncate text-muted">{card.jobTitle ?? "General pipeline"}</span>
                        <Badge variant="violet">{PIPELINE_STAGE_LABEL[card.stage]}</Badge>
                      </li>
                    ))}
                    {c.context.applications.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-2">
                        <span className="truncate text-muted">Applied: {a.jobTitle}</span>
                        <Badge>{a.stage}</Badge>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
              {contact && (
                <ContactUnlockCard
                  studentUserId={c.user.id}
                  firstName={c.user.name.split(" ")[0] ?? c.user.name}
                  unlocked={contact.unlocked}
                  email={contact.email}
                  usage={contact.usage}
                  mode={billingMode}
                />
              )}
              <CandidateActions
                studentUserId={c.user.id}
                firstName={c.user.name.split(" ")[0] ?? c.user.name}
                jobs={jobs.filter((j) => j.status !== "closed").map((j) => ({ id: j.id, title: j.title }))}
                shortlists={lists}
                memberOf={c.context.shortlists.map((s) => s.id)}
                checks={checks.map((k) => ({ id: k.id, title: k.title, level: k.level }))}
                notes={c.context.notes.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }))}
              />
            </>
          ) : (
            <Card variant="flat" className="p-4 text-sm text-muted">
              Join a company workspace to shortlist, message and add notes.
            </Card>
          )}
          <Card variant="flat" className="p-4 text-xs text-muted">
            <p className="inline-flex items-center gap-1.5 font-medium text-ink">
              <BadgeCheck className="size-3.5 text-verified" aria-hidden /> How to read this
            </p>
            <p className="mt-1.5 leading-relaxed">
              Every item above was verified by Proof: commit authorship from GitHub, deployments by token, checks graded in a sandbox, endorsements from domain-verified mentors.
            </p>
          </Card>
        </aside>
      </div>
    </>
  );
}

function EvidenceSection({
  icon: Icon,
  title,
  count,
  empty,
  children,
  id,
}: {
  icon: typeof Globe;
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
  id?: string;
}) {
  const items = Array.isArray(children) ? children : [children];
  const hasItems = items.flat().filter(Boolean).length > 0;
  return (
    <Card id={id} className="scroll-mt-24 target:ring-2 target:ring-lime/60">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="inline-flex items-center gap-2">
          <Icon className="size-4 text-subtle" aria-hidden /> {title}
        </CardTitle>
        <span className="font-mono text-xs text-muted tabular">{count}</span>
      </CardHeader>
      <CardContent>{hasItems ? <ul className="divide-y divide-line">{children}</ul> : <p className="text-sm text-muted">{empty}</p>}</CardContent>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-subtle">{label}</dt>
      <dd className="font-mono text-ink tabular">{value}</dd>
    </div>
  );
}
