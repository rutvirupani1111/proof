import { ArrowRight, ClipboardCheck, GitBranch, Globe, MessagesSquare, Quote, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SealGlyph } from "@/components/ui/seal-glyph";
import type { InterviewKit, KitQuestion, KitSource } from "@/server/recruiter/interview-kit";

const SOURCE: Record<KitSource, { icon: LucideIcon; label: string }> = {
  repo: { icon: GitBranch, label: "Repository" },
  deployment: { icon: Globe, label: "Live deployment" },
  check: { icon: ClipboardCheck, label: "Skill check" },
  endorsement: { icon: Quote, label: "Endorsement" },
};

function QuestionItem({ q, n, candidateId }: { q: KitQuestion; n: number; candidateId: string }) {
  const meta = SOURCE[q.source];
  const Icon = meta.icon;
  return (
    <li className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3 break-inside-avoid py-4 first:pt-0 last:pb-0">
      <span className="grid size-7 place-items-center rounded-lg bg-surface-2 font-mono text-xs font-semibold text-ink print:border print:border-line">
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-[15px] leading-relaxed text-pretty text-ink">{q.prompt}</p>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1 font-mono text-[10.5px] tracking-wider text-subtle uppercase">
            <Icon className="size-3" aria-hidden /> {meta.label}
          </span>
          <Link
            href={`/recruiter/candidates/${candidateId}${q.href}`}
            className="inline-flex items-center gap-1 underline decoration-lime decoration-2 underline-offset-[3px] hover:text-ink print:no-underline"
          >
            <SealGlyph className="size-3 text-lime" /> {q.basis}
          </Link>
        </p>
        <ul className="mt-2 grid gap-1 text-xs text-muted">
          {q.listenFor.map((l) => (
            <li key={l} className="flex gap-2">
              <span className="text-subtle" aria-hidden>
                Listen for
              </span>
              <span className="sr-only">Listen for: </span>
              <span>{l}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 hidden h-14 rounded-lg border border-dashed border-line print:block" aria-hidden />
      </div>
    </li>
  );
}

/** The full, printable kit: one card per skill, numbered questions with their evidence. */
export function InterviewKitView({ kit, candidateId }: { kit: InterviewKit; candidateId: string }) {
  let n = 0;
  return (
    <div className="grid gap-5">
      {kit.groups.map((g) => (
        <Card key={g.skillSlug ?? "general"} className="break-inside-avoid-page p-5 sm:p-6 print:shadow-none">
          <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-line pb-3">
            <h2 className="font-display text-lg font-semibold tracking-tight">{g.skillName}</h2>
            {g.score != null && (
              <span className="inline-flex items-center gap-1 font-mono text-xs text-verified">
                <SealGlyph className="size-3.5 text-lime" /> verified {g.score}
              </span>
            )}
          </div>
          <ol className="divide-y divide-line">
            {g.questions.map((q) => (
              <QuestionItem key={q.id} q={q} n={++n} candidateId={candidateId} />
            ))}
          </ol>
        </Card>
      ))}
    </div>
  );
}

/** Teaser on the candidate dossier: count, first two questions and a link to the full kit. */
export function InterviewKitPreview({ kit, candidateId, firstName }: { kit: InterviewKit; candidateId: string; firstName: string }) {
  const first = kit.groups.flatMap((g) => g.questions).slice(0, 2);
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">
            <MessagesSquare className="size-3.5" aria-hidden /> Interview kit
          </p>
          <h2 className="mt-1 font-display text-lg font-semibold tracking-tight">
            {kit.hasEvidence
              ? `${kit.total} questions from ${firstName}'s own work`
              : `No verified work to build questions from yet`}
          </h2>
        </div>
        {kit.hasEvidence && (
          <Button variant="secondary" size="sm" asChild>
            <Link href={`/recruiter/candidates/${candidateId}/interview-kit`}>
              Open kit <ArrowRight />
            </Link>
          </Button>
        )}
      </div>
      {first.length > 0 && (
        <ul className="mt-4 grid gap-2.5">
          {first.map((q) => (
            <li key={q.id} className="rounded-xl border border-line bg-surface-2/60 px-3.5 py-2.5 text-sm text-pretty text-ink">
              {q.prompt}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
