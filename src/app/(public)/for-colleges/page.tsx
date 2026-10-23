import { BarChart3, BellRing, Building2, CalendarClock, FileDown, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { CollegeVignette } from "@/components/landing/audience-visuals";
import { CtaBand } from "@/components/landing/cta-band";
import { FeatureGrid, type Feature } from "@/components/landing/feature-grid";
import { PageHero } from "@/components/landing/page-hero";
import { SectionIntro } from "@/components/landing/section-intro";
import { Stagger, StaggerItem } from "@/components/motion";

export const metadata: Metadata = {
  title: "For colleges",
  description:
    "A placement cell built on verified skills: cohort readiness, skills gap, company drives with real eligibility, and placement stats you can export.",
};

const FEATURES: Feature[] = [
  { icon: BarChart3, title: "Cohort readiness", body: "A funnel from enrolled to job-ready, built only from verified evidence. See exactly where each batch stalls." },
  {
    icon: ShieldCheck,
    title: "Verified skills distribution",
    body: "Which skills your students have actually proven, by score band, and the biggest gap against what companies ask for.",
  },
  { icon: CalendarClock, title: "Company drives", body: "Schedule drives, set eligibility on verified skill scores, and track results from shortlist to offer." },
  { icon: FileDown, title: "Placement stats + CSV", body: "Placed, offers, median package and company mix per batch, exportable for your accreditation reports." },
  { icon: BellRing, title: "Nudges that land", body: "Remind students with incomplete proofs exactly what to do next: connect GitHub, deploy a project, take a check." },
  {
    icon: Building2,
    title: "Domain-verified cell",
    body: "Placement officers verify the college email domain once. Faculty mentors endorse students from the same verified domain.",
  },
];

const ROLLOUT = [
  { t: "Day 1", title: "Verify your domain", body: "A placement officer signs up with the college email and confirms the domain." },
  { t: "Day 2", title: "Invite the cohort", body: "Share one link. Students sign up free and pick the skills they want to prove." },
  { t: "Week 1", title: "Students prove their work", body: "GitHub ownership, repos, live projects and skill checks start filling the readiness funnel." },
  { t: "Week 2", title: "Run evidence-based drives", body: "Eligibility on verified scores, not marks alone. Companies see dossiers, not PDFs." },
];

export default function ForCollegesPage() {
  return (
    <main>
      <PageHero
        eyebrow="For placement cells"
        title={
          <>
            Know who is <span className="text-verified">truly</span> job-ready.
          </>
        }
        lede={
          <p>
            Self-reported skills tell you nothing. Proof shows your placement cell the skills students have actually demonstrated, and
            what to fix before drive season.
          </p>
        }
        primary={{ href: "/signup?role=college", label: "Set up your cell" }}
        secondary={{ href: "/pricing#colleges", label: "College pricing" }}
        visual={<CollegeVignette />}
      />

      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <SectionIntro eyebrow="The college workspace" title="Placement, measured on evidence.">
          <p>Students stay in control of their privacy. Your cell sees cohort-level evidence and the dossiers students choose to share.</p>
        </SectionIntro>
        <div className="mt-10">
          <FeatureGrid features={FEATURES} />
        </div>
      </section>

      <section className="border-y border-line bg-surface-2/50">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <SectionIntro eyebrow="Rollout" title="Live before the next drive.">
            <p>No integration project and no data migration. Students bring their own evidence.</p>
          </SectionIntro>
          <Stagger inView className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ROLLOUT.map((r, i) => (
              <StaggerItem key={r.title} className="relative rounded-[var(--radius-card)] border border-line bg-surface bg-ledger p-5 shadow-card">
                <p className="font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">{r.t}</p>
                <p className="mt-3 font-display text-4xl font-semibold text-line-strong" aria-hidden>
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-2 font-semibold">{r.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{r.body}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <CtaBand
        title="Placement season, with receipts."
        body="Free for every student you invite. Your cell pays per campus, per year."
        primary={{ href: "/signup?role=college", label: "Set up your cell" }}
        secondary={{ href: "/about", label: "Why Proof" }}
      />
    </main>
  );
}
