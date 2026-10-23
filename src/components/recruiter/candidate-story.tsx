import { BookOpenText, CircleAlert, CircleCheck, X } from "lucide-react";
import Link from "next/link";
import { FadeIn } from "@/components/motion/fade-in";
import { cn } from "@/lib/utils";
import type { CandidateStory, StoryPart, StoryPoint } from "@/server/recruiter/candidate-story";

function Parts({ parts }: { parts: StoryPart[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.href ? (
          <a
            key={i}
            href={p.href}
            className="rounded-sm font-semibold text-ink underline decoration-lime decoration-2 underline-offset-[3px] transition-colors hover:bg-lime/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {p.text}
          </a>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

function PointList({ title, points, tone }: { title: string; points: StoryPoint[]; tone: "strength" | "gap" }) {
  const Icon = tone === "strength" ? CircleCheck : CircleAlert;
  return (
    <div className="min-w-0">
      <p className={cn("mb-2 font-mono text-[11px] tracking-wider uppercase", tone === "strength" ? "text-verified" : "text-coral-text")}>
        {title} <span className="text-subtle">{points.length}</span>
      </p>
      {points.length === 0 ? (
        <p className="text-sm text-muted">{tone === "strength" ? "Nothing clears this job's bar yet." : "No gaps against this job."}</p>
      ) : (
        <ul className="grid gap-2">
          {points.map((pt, i) => (
            <li key={i} className="flex gap-2 text-sm leading-snug">
              <Icon className={cn("mt-0.5 size-4 shrink-0", tone === "strength" ? "text-verified" : "text-coral-text")} aria-hidden />
              <span className="min-w-0 text-pretty text-muted">
                <Parts parts={pt.parts} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The plain-English candidate story. Every number links down to the dossier section that proves
 * it. With a job in context, strengths and gaps against that job's bar follow.
 */
export function CandidateStoryCard({
  story,
  candidateId,
  job,
  jobs,
}: {
  story: CandidateStory;
  candidateId: string;
  job: { id: string; title: string } | null;
  /** This company's open jobs, offered as "compare against" links. */
  jobs: { id: string; title: string }[];
}) {
  return (
    <FadeIn>
      <section aria-labelledby="story-title" className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-card">
        <div className="relative p-5 sm:p-6">
          <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 size-44 rounded-full bg-lime/20 blur-3xl motion-safe:animate-pulse" />
          <h2 id="story-title" className="relative inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">
            <BookOpenText className="size-3.5" aria-hidden /> The story, from evidence only
          </h2>
          <p className="relative mt-2 font-display text-lg leading-relaxed text-pretty text-ink sm:text-xl">
            <Parts parts={story.parts} />
          </p>
          <p className="relative mt-2 text-xs text-subtle">Generated from verified records; tap any number to see the proof.</p>
        </div>

        {job ? (
          <div className="border-t border-line bg-surface-2/50 px-5 py-4 sm:px-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm">
                <span className="text-muted">Against </span>
                <span className="font-medium">{job.title}</span>
              </p>
              <Link
                href={`/recruiter/candidates/${candidateId}`}
                scroll={false}
                className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs text-muted hover:bg-surface-3 hover:text-ink"
              >
                <X className="size-3.5" aria-hidden /> Clear job
              </Link>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <PointList title="Strengths" points={story.strengths} tone="strength" />
              <PointList title="Gaps vs. this job" points={story.gaps} tone="gap" />
            </div>
          </div>
        ) : (
          jobs.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-2/50 px-5 py-3 sm:px-6">
              <span className="font-mono text-[11px] tracking-wider text-subtle uppercase">Check against</span>
              {jobs.slice(0, 4).map((j) => (
                <Link
                  key={j.id}
                  href={`/recruiter/candidates/${candidateId}?job=${j.id}`}
                  scroll={false}
                  className="inline-flex min-h-8 max-w-full items-center truncate rounded-full border border-line bg-surface px-3 text-xs hover:border-line-strong hover:bg-surface-3"
                >
                  {j.title}
                </Link>
              ))}
            </div>
          )
        )}
      </section>
    </FadeIn>
  );
}
