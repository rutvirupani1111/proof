import {
  ArrowRight,
  BarChart3,
  BookCheck,
  Code2,
  FileSignature,
  GitBranch,
  Globe,
  KanbanSquare,
  Search,
  UserRoundCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { HeroEvidence } from "@/components/marketing/hero-evidence";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SealGlyph } from "@/components/ui/seal-glyph";

const ENGINE: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: GitBranch, title: "GitHub ownership", body: "A public proof.md gist with your handle and a one-time nonce. No OAuth, no trust me." },
  { icon: Code2, title: "Code authorship", body: "Your own commits, active weeks, languages and authorship share. Bulk-imported history gets flagged." },
  { icon: Globe, title: "Live deployments", body: "A meta tag or /.well-known/proof.txt proves the site is yours, and we keep checking it is up." },
  { icon: BookCheck, title: "Skill checks", body: "Timed tasks graded server-side in a sandbox against hidden tests. Signals shown, never auto-penalised." },
  { icon: UserRoundCheck, title: "Mentor attestations", body: "Professors and seniors endorse specific work, from an institutional domain they proved they own." },
  { icon: FileSignature, title: "Signed credentials", body: "Every item becomes an Ed25519-signed Verifiable Credential. Anyone can check it at /verify." },
];

const AUDIENCES = [
  {
    id: "students",
    eyebrow: "For students",
    title: "Your work, finally legible.",
    body: "Stop rewording the same resume. Connect GitHub, verify a live project, pass a skill check, and let your evidence do the talking.",
    points: ["One shareable verified dossier", "A Proof Score that explains itself", "Apply with evidence, track every stage"],
    cta: { label: "Build your Proof", href: "/signup?role=student" },
    icon: GitBranch,
  },
  {
    id: "recruiters",
    eyebrow: "For recruiters",
    title: "Search evidence, not keywords.",
    body: "Filter by verified skill, live deployments, own commits and passed checks. Shortlist, compare and run your pipeline in one place.",
    points: ["Evidence search with saved filters", "Compare up to three candidates", "Kanban pipeline with skill-check invites"],
    cta: { label: "Hire on evidence", href: "/signup?role=recruiter" },
    icon: Search,
  },
  {
    id: "colleges",
    eyebrow: "For colleges",
    title: "See who is truly job-ready.",
    body: "A placement cell built on verified skills: cohort readiness, company drives with real eligibility, and placement stats you can export.",
    points: ["Readiness funnel and skills gap", "Drives with eligible-student lists", "Nudges for incomplete proofs"],
    cta: { label: "Set up your cell", href: "/signup?role=college" },
    icon: BarChart3,
  },
];

const SCORE = [
  { label: "Code authorship", value: 31, max: 35 },
  { label: "Live deployments", value: 18, max: 20 },
  { label: "Skill checks", value: 21, max: 25 },
  { label: "Mentor endorsements", value: 12, max: 20 },
];

export default function LandingPage() {
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-dots [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)] opacity-70" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pt-16 pb-24 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-24">
          <FadeIn>
            <Badge variant="outline" mono className="mb-6 text-[11px] tracking-wider uppercase">
              Hiring on verified work
            </Badge>
            <h1 className="font-display text-[2.6rem] leading-[0.98] font-semibold tracking-[-0.035em] text-balance sm:text-6xl lg:text-7xl">
              Resumes are claims.
              <br />
              <span className="relative inline-block">
                <span className="relative z-10">Proof is evidence.</span>
                <span className="absolute inset-x-0 bottom-[0.08em] -z-0 h-[0.32em] -skew-x-6 bg-lime/80 dark:bg-lime/30" aria-hidden />
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base text-pretty text-muted sm:text-lg">
              Every year about a crore graduates in India apply with near-identical, increasingly AI-written resumes.
              Proof turns real work into verified evidence: code you actually wrote, projects that are actually live,
              checks you actually passed, and endorsements from real mentors.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/signup?role=student">
                  Build your Proof <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <Link href="/signup?role=recruiter">I am hiring</Link>
              </Button>
            </div>
            <p className="mt-6 flex items-center gap-2 font-mono text-xs text-subtle">
              <SealGlyph className="size-4 text-verified" /> Free for students. Every credential publicly verifiable.
            </p>
          </FadeIn>
          <FadeIn delay={0.15} direction="left" className="mx-auto w-full max-w-md lg:max-w-none">
            <HeroEvidence />
          </FadeIn>
        </div>
      </section>

      {/* Verification engine */}
      <section id="engine" className="scroll-mt-20 border-y border-line bg-surface-2/50">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <FadeIn inView className="max-w-2xl">
            <p className="font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">The verification engine</p>
            <h2 className="mt-3 text-3xl font-semibold text-balance sm:text-4xl">Six ways a claim becomes evidence.</h2>
            <p className="mt-3 text-muted">
              Each check produces an evidence record and a signed credential. Nothing on a Proof profile is self-reported.
            </p>
          </FadeIn>
          <Stagger inView className="mt-10 grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {ENGINE.map(({ icon: Icon, title, body }, i) => (
              <StaggerItem key={title} className="bg-surface p-6">
                <div className="flex items-center justify-between">
                  <span className="grid size-10 place-items-center rounded-xl bg-surface-2">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="font-mono text-xs text-subtle">0{i + 1}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Audiences */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {AUDIENCES.map((a, i) => (
            <FadeIn
              key={a.id}
              id={a.id}
              inView
              delay={i * 0.08}
              className="flex scroll-mt-24 flex-col rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-card"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-lime text-lime-ink">
                <a.icon className="size-5" aria-hidden />
              </span>
              <p className="mt-5 font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">{a.eyebrow}</p>
              <h2 className="mt-2 text-2xl font-semibold">{a.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{a.body}</p>
              <ul className="mt-5 grid gap-2 border-t border-dashed border-line-strong pt-5 text-sm">
                {a.points.map((p) => (
                  <li key={p} className="flex items-start gap-2">
                    <SealGlyph className="mt-0.5 size-4 shrink-0 text-verified" />
                    {p}
                  </li>
                ))}
              </ul>
              <Button variant="secondary" asChild className="mt-6 self-start">
                <Link href={a.cta.href}>
                  {a.cta.label} <ArrowRight />
                </Link>
              </Button>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Score */}
      <section className="border-t border-line bg-surface-2/50">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <FadeIn inView>
            <p className="font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">Proof Score</p>
            <h2 className="mt-3 text-3xl font-semibold text-balance sm:text-4xl">Never a black box.</h2>
            <p className="mt-3 max-w-lg text-muted">
              A 0-100 score per skill and overall, built from weighted evidence: authorship volume and recency, live
              deployments, passed checks and mentor endorsements. Ask “why 82?” and see every line item.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Badge variant="neutral"><Users className="size-3" /> Recruiters see the same breakdown</Badge>
              <Badge variant="neutral"><KanbanSquare className="size-3" /> Usable as a pipeline filter</Badge>
            </div>
          </FadeIn>
          <FadeIn inView delay={0.1} className="rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-card">
            <div className="flex items-end justify-between border-b border-line pb-4">
              <div>
                <p className="font-mono text-[11px] tracking-wider text-subtle uppercase">Why 82?</p>
                <p className="font-display text-5xl font-semibold tabular text-verified">82</p>
              </div>
              <Badge variant="verified" mono>14 evidence items</Badge>
            </div>
            <ul className="mt-5 grid gap-4">
              {SCORE.map((s) => (
                <li key={s.label} className="grid gap-1.5">
                  <div className="flex justify-between text-sm">
                    <span>{s.label}</span>
                    <span className="font-mono text-muted tabular">
                      {s.value}/{s.max}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-lime" style={{ width: `${(s.value / s.max) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </FadeIn>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6">
        <FadeIn inView>
          <h2 className="mx-auto max-w-3xl text-4xl font-semibold text-balance sm:text-5xl">
            Show the work. <span className="text-verified">Get the seal.</span>
          </h2>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/signup">Create your account</Link>
            </Button>
            <Button size="lg" variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </FadeIn>
      </section>
    </main>
  );
}
