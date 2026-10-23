import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { CollegeVignette, RecruiterVignette, StudentVignette } from "@/components/landing/audience-visuals";
import { CtaBand } from "@/components/landing/cta-band";
import { EvidenceTicker } from "@/components/landing/evidence-ticker";
import { Faq, type FaqItem } from "@/components/landing/faq";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { SectionIntro } from "@/components/landing/section-intro";
import { StatsBand } from "@/components/landing/stats-band";
import { FadeIn } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { SealGlyph } from "@/components/ui/seal-glyph";
import { Skeleton } from "@/components/ui/skeleton";
import { getEvidenceTicker, getFeaturedHandle, getLandingStats } from "@/server/public/queries";

// Ticker and numbers are live from the ledger; they stream in behind the static hero.
export const dynamic = "force-dynamic";

const AUDIENCES: { id: string; eyebrow: string; title: string; body: string; points: string[]; cta: { href: string; label: string }; visual: ReactNode }[] = [
  {
    id: "students",
    eyebrow: "For students",
    title: "Your work, finally legible.",
    body: "Stop rewording the same resume. Prove a GitHub account, point at code you wrote, put a project online, pass a check. Your dossier fills itself with seals.",
    points: ["One shareable verified dossier with a QR", "A Proof Score that shows its working", "Free forever, including every credential"],
    cta: { href: "/signup?role=student", label: "Build your Proof" },
    visual: <StudentVignette />,
  },
  {
    id: "recruiters",
    eyebrow: "For recruiters",
    title: "Search evidence, not keywords.",
    body: "Filter by verified skill score, live deployments, own commits, passed checks and mentor endorsements. Shortlist, compare three side by side, run the pipeline.",
    points: ["Evidence search with saved filters", "Skill-check invites with hidden tests", "Kanban pipeline, notes and messages"],
    cta: { href: "/for-recruiters", label: "See the recruiter side" },
    visual: <RecruiterVignette />,
  },
  {
    id: "colleges",
    eyebrow: "For placement cells",
    title: "Know who is truly job-ready.",
    body: "A cohort view built on verified skills rather than self-reported ones: a readiness funnel, the skills gap, drives with real eligibility, and stats you can export.",
    points: ["Readiness funnel and top skills gap", "Company drives with eligible lists", "Nudges for incomplete proofs"],
    cta: { href: "/for-colleges", label: "See the college side" },
    visual: <CollegeVignette />,
  },
];

const FAQ: FaqItem[] = [
  {
    q: "Is Proof really free for students?",
    a: "Yes, forever. Verification, the dossier, credentials, skill checks and applying to jobs cost students nothing. Recruiters and colleges pay for the hiring and placement tools.",
  },
  {
    q: "Do I have to give Proof access to my GitHub?",
    a: "No. You prove ownership by posting a public gist containing your Proof handle and a one-time code. Proof reads only public data from GitHub's API.",
  },
  {
    q: "What stops someone copying a repo and claiming it?",
    a: "Authorship is measured per commit author, not per repo. Forks without your own commits, history imported in one day, and repos created days ago with years of commits are all flagged.",
  },
  {
    q: "How can a recruiter be sure a seal is real?",
    a: "Every seal is an Ed25519-signed W3C Verifiable Credential. Open its /verify link or scan the QR: lime means Proof issued it and nothing changed; coral means it was altered, revoked or never issued.",
  },
  {
    q: "Is the Proof Score a black box?",
    a: "Never. Every score has a 'why' panel listing each contribution: authorship volume and recency, live deployments, passed checks and mentor endorsements. Recruiters see the same breakdown you do.",
  },
  {
    q: "Who can see my profile?",
    a: "You choose: public, recruiters only, or hidden. Hidden profiles return a 404 to everyone but you, and only public profiles appear in link previews or the live evidence ticker.",
  },
  {
    q: "Can mentors endorse anything they like?",
    a: "Mentors first prove an institutional email domain (a college or company). They then endorse a specific skill or project, shown as 'Verified mentor at @domain'. Endorsements are one input, never the whole score.",
  },
];

async function FeaturedLink() {
  const handle = await getFeaturedHandle();
  if (!handle) return null;
  return (
    <p className="mt-5 text-sm text-muted">
      Or{" "}
      <Link href={`/u/${handle}`} className="font-medium text-ink underline decoration-lime decoration-2 underline-offset-4 hover:decoration-verified">
        open a real verified dossier
      </Link>
      .
    </p>
  );
}

async function Ticker() {
  return <EvidenceTicker items={await getEvidenceTicker(18)} />;
}

async function Numbers() {
  return <StatsBand stats={await getLandingStats()} />;
}

export default function LandingPage() {
  return (
    <main>
      <Hero
        featured={
          <Suspense fallback={null}>
            <FeaturedLink />
          </Suspense>
        }
      />

      <Suspense fallback={<div className="h-[52px] border-y border-line bg-surface/70" />}>
        <Ticker />
      </Suspense>

      {/* Audiences */}
      <div className="mx-auto grid max-w-6xl gap-24 px-4 py-24 sm:px-6 sm:py-28">
        {AUDIENCES.map((a, i) => (
          <section key={a.id} id={a.id} aria-labelledby={`${a.id}-h`} className="grid scroll-mt-24 items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div className={i % 2 === 1 ? "lg:order-2" : undefined}>
              <SectionIntro id={`${a.id}-h`} eyebrow={a.eyebrow} title={a.title}>
                <p>{a.body}</p>
              </SectionIntro>
              <FadeIn inView delay={0.1}>
                <ul className="mt-6 grid gap-2.5 border-t border-dashed border-line-strong pt-6 text-[15px]">
                  {a.points.map((p) => (
                    <li key={p} className="flex items-start gap-2.5">
                      <SealGlyph className="mt-0.5 size-4.5 shrink-0 text-verified" />
                      {p}
                    </li>
                  ))}
                </ul>
                <Button variant="secondary" asChild className="mt-7">
                  <Link href={a.cta.href}>
                    {a.cta.label} <ArrowRight />
                  </Link>
                </Button>
              </FadeIn>
            </div>
            <FadeIn inView delay={0.12} direction={i % 2 === 1 ? "right" : "left"} className="mx-auto w-full max-w-lg">
              {a.visual}
            </FadeIn>
          </section>
        ))}
      </div>

      {/* How verification works */}
      <section id="how" aria-labelledby="how-h" className="scroll-mt-20 border-y border-line bg-surface-2/50">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <SectionIntro id="how-h" eyebrow="How verification works" title="Five steps from claim to signed evidence.">
            <p>Nothing on a Proof dossier is self-reported. Each step produces an evidence record and a credential anyone can check.</p>
          </SectionIntro>
          <div className="mt-12">
            <HowItWorks />
          </div>
        </div>
      </section>

      {/* Numbers */}
      <section aria-labelledby="numbers-h" className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <SectionIntro id="numbers-h" eyebrow="The ledger, live" title="No testimonials. Just the count.">
          <p>Straight from the evidence ledger, right now. Every number below is made of seals you can open.</p>
        </SectionIntro>
        <div className="mt-10">
          <Suspense fallback={<Skeleton className="h-72 w-full rounded-[var(--radius-card)]" />}>
            <Numbers />
          </Suspense>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" aria-labelledby="faq-h" className="scroll-mt-20 border-t border-line bg-surface-2/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionIntro id="faq-h" eyebrow="Questions" title="The fine print, in plain words.">
            <p>
              Still curious?{" "}
              <Link href="/about" className="text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                Read why we built Proof
              </Link>
              .
            </p>
          </SectionIntro>
          <FadeIn inView delay={0.08}>
            <Faq items={FAQ} />
          </FadeIn>
        </div>
      </section>

      <CtaBand />
    </main>
  );
}
