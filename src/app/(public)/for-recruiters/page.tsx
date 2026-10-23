import { BookCheck, Columns3, FileSearch, KanbanSquare, MessagesSquare, Users } from "lucide-react";
import type { Metadata } from "next";
import { CtaBand } from "@/components/landing/cta-band";
import { FeatureGrid, type Feature } from "@/components/landing/feature-grid";
import { PageHero } from "@/components/landing/page-hero";
import { SearchDemo } from "@/components/landing/search-demo";
import { SectionIntro } from "@/components/landing/section-intro";
import { FadeIn } from "@/components/motion";
import { SealGlyph } from "@/components/ui/seal-glyph";

export const metadata: Metadata = {
  title: "For recruiters",
  description:
    "Search verified skills instead of keywords: own commits, live deployments, passed skill checks and mentor endorsements, each backed by a signed credential.",
};

const FEATURES: Feature[] = [
  {
    icon: FileSearch,
    title: "Evidence search",
    body: "Filter by skill score, live deployments, own commits, passed checks, mentor endorsements, college and graduation year. Save the searches you run every week.",
  },
  {
    icon: Users,
    title: "Evidence-first candidate view",
    body: "Open a candidate and see the work before the name: repos with authorship share, sites with uptime, checks with hidden-test results.",
  },
  {
    icon: Columns3,
    title: "Compare up to three",
    body: "Side-by-side dossiers with the same score breakdown each candidate sees. Differences are evidence, not adjectives.",
  },
  {
    icon: KanbanSquare,
    title: "Pipeline kanban",
    body: "Sourced, Contacted, Skill check, Interview, Offer, Hired. Drag cards between stages; every move is logged.",
  },
  {
    icon: BookCheck,
    title: "Skill-check invites",
    body: "Send a timed task graded server-side against hidden tests. Paste and tab-switch signals are shown, never auto-penalised.",
  },
  {
    icon: MessagesSquare,
    title: "Messages and notes",
    body: "Talk to candidates in-app and keep private notes your teammates can see. Your company domain is verified first.",
  },
];

const SEAL_FACTS = [
  { kind: "Code authorship", facts: "own commits, authorship share, active weeks, languages, red flags checked" },
  { kind: "Live deployment", facts: "token on the site, status code, response time, last health check" },
  { kind: "Skill check", facts: "hidden tests passed, time taken, attempts, integrity signals" },
  { kind: "Mentor endorsement", facts: "who, from which verified domain, about which skill or project" },
];

export default function ForRecruitersPage() {
  return (
    <main>
      <PageHero
        eyebrow="For recruiters"
        title={
          <>
            Hire on what they <span className="text-verified">built</span>, not what they typed.
          </>
        }
        lede={
          <p>
            Every candidate on Proof arrives with sealed evidence: code they wrote, sites that are live, checks they passed. Search it the
            way you search a database.
          </p>
        }
        primary={{ href: "/signup?role=recruiter", label: "Start hiring" }}
        secondary={{ href: "/pricing", label: "See pricing" }}
        visual={<SearchDemo />}
      />

      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <SectionIntro eyebrow="The recruiter workspace" title="Everything between a search and an offer.">
          <p>One workspace per company, scoped to your verified domain. Teammates see the same shortlists, pipeline and notes.</p>
        </SectionIntro>
        <div className="mt-10">
          <FeatureGrid features={FEATURES} />
        </div>
      </section>

      <section className="border-y border-line bg-surface-2/50">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:items-center">
          <SectionIntro eyebrow="What a seal tells you" title="Receipts, not adjectives.">
            <p>A seal is a snapshot of facts captured at verification time, then signed. Open any seal to see them, or verify the credential yourself.</p>
          </SectionIntro>
          <FadeIn inView delay={0.08}>
            <ul className="grid gap-3">
              {SEAL_FACTS.map((s) => (
                <li key={s.kind} className="flex gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card">
                  <SealGlyph className="mt-0.5 size-6 shrink-0 -rotate-12 text-verified" />
                  <div>
                    <p className="font-semibold">{s.kind}</p>
                    <p className="mt-0.5 font-mono text-[12.5px] text-muted">{s.facts}</p>
                  </div>
                </li>
              ))}
            </ul>
          </FadeIn>
        </div>
      </section>

      <CtaBand
        title="Stop reading resumes. Read evidence."
        body="Set up a company workspace in minutes and run your first evidence search today."
        primary={{ href: "/signup?role=recruiter", label: "Create a workspace" }}
        secondary={{ href: "/verify", label: "Verify a credential" }}
      />
    </main>
  );
}
