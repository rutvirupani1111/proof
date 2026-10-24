import { Building, Landmark } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CtaBand } from "@/components/landing/cta-band";
import { Faq, type FaqItem } from "@/components/landing/faq";
import { PricingPlans } from "@/components/landing/pricing-plans";
import { SectionIntro } from "@/components/landing/section-intro";
import { FadeIn } from "@/components/motion";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Free for students, forever. Simple plans for recruiters and placement cells.",
};

const FAQ: FaqItem[] = [
  {
    q: "Why is it free for students?",
    a: "Because the evidence is theirs. Charging students to prove their own work would recreate the problem Proof exists to fix. Recruiters and colleges pay for the tools they use to act on that evidence.",
  },
  {
    q: "Does a paid plan buy a better Proof Score?",
    a: "No. Scores come only from verified evidence. Nobody can pay to raise a score, appear higher in search, or remove a red flag.",
  },
  {
    q: "Can recruiters see hidden profiles?",
    a: "No. Students choose public, recruiters-only or hidden. Hidden profiles do not appear in search and their dossier returns a 404.",
  },
  {
    q: "Do you offer pilots for colleges?",
    a: "Yes. A placement cell can run one batch free for a semester. Write to us from your college domain.",
  },
];

export default function PricingPage() {
  return (
    <main>
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 bg-dots opacity-50 [mask-image:radial-gradient(60%_70%_at_50%_0%,black,transparent)]" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 pt-14 pb-20 sm:px-6 sm:pt-20">
          <FadeIn className="mx-auto max-w-2xl text-center">
            <p className="font-mono text-[11px] tracking-[0.16em] text-subtle uppercase">Pricing</p>
            <h1 className="mt-4 text-[2.5rem] leading-[0.98] font-semibold tracking-[-0.04em] text-balance sm:text-6xl">
              Free for students. <span className="text-verified">Forever.</span>
            </h1>
            <p className="mt-5 text-pretty text-muted sm:text-lg">Proving your work never costs a rupee. Teams that hire and place on evidence pay a simple, flat price.</p>
          </FadeIn>
          <div className="mt-12">
            <PricingPlans />
          </div>
          <p className="mt-6 text-center font-mono text-[11px] text-subtle">Prices in INR, exclusive of GST. Payments run in Stripe test mode: use card 4242 4242 4242 4242.</p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-4 py-20 sm:px-6 md:grid-cols-2">
        {[
          { icon: Building, title: "Enterprise hiring", body: "SSO, ATS export, custom skill checks and volume seats for campus hiring at scale.", cta: "/signup?role=recruiter" },
          { icon: Landmark, title: "Universities and groups", body: "One contract across many campuses, group-level dashboards and accreditation exports.", cta: "/signup?role=college" },
        ].map(({ icon: Icon, title, body, cta }) => (
          <FadeIn key={title} inView className="flex flex-col rounded-[var(--radius-card)] border border-dashed border-line-strong p-6">
            <Icon className="size-5 text-subtle" aria-hidden />
            <h2 className="mt-4 text-xl font-semibold">{title}</h2>
            <p className="mt-1.5 flex-1 text-sm text-muted">{body}</p>
            <Button variant="ghost" asChild className="mt-4 self-start">
              <Link href={cta}>Talk to us</Link>
            </Button>
          </FadeIn>
        ))}
      </section>

      <section aria-labelledby="pricing-faq" className="border-t border-line bg-surface-2/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionIntro id="pricing-faq" eyebrow="Pricing questions" title="Paying never changes the evidence." />
          <Faq items={FAQ} />
        </div>
      </section>

      <CtaBand />
    </main>
  );
}
