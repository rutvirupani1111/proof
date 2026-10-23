import { Eye, Gift, Lock, Scale, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { CtaBand } from "@/components/landing/cta-band";
import { SectionIntro } from "@/components/landing/section-intro";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { Seal } from "@/components/ui/seal";

export const metadata: Metadata = {
  title: "About",
  description: "Why Proof exists: resumes became claims nobody can check. Proof turns real work into signed, verifiable evidence.",
};

const PRINCIPLES = [
  { icon: ShieldCheck, title: "Evidence over claims", body: "Nothing on a dossier is self-reported. If it cannot be verified, it does not get a seal." },
  { icon: Scale, title: "Never a black box", body: "Every score explains itself line by line. Students and recruiters see the same breakdown." },
  { icon: Gift, title: "Free for students, forever", body: "Proving your own work should never cost money. Hiring and placement teams fund the platform." },
  { icon: Lock, title: "Private by default", body: "Students choose who sees what. Hidden means hidden: a 404 to everyone else, no previews, no search." },
  { icon: Eye, title: "Verifiable by anyone", body: "Credentials are signed with Ed25519 and checkable at a public URL. You do not have to trust us; check the signature." },
];

export default function AboutPage() {
  return (
    <main>
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0 bg-ledger opacity-80" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pt-14 pb-20 sm:px-6 sm:pt-20 lg:grid-cols-[1.3fr_0.7fr] lg:items-center">
          <FadeIn>
            <p className="font-mono text-[11px] tracking-[0.16em] text-subtle uppercase">About Proof</p>
            <h1 className="mt-4 text-[2.5rem] leading-[0.98] font-semibold tracking-[-0.04em] text-balance sm:text-6xl">
              The resume stopped meaning anything. So we built the receipt.
            </h1>
          </FadeIn>
          <FadeIn delay={0.15} className="hidden justify-center lg:flex">
            <Seal size={200} stamp="mount" delay={0.5} label="Evidence, not claims ·" />
          </FadeIn>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <FadeIn inView className="grid gap-6 text-[1.075rem] leading-relaxed text-pretty">
          <p>
            Every year around a crore graduates in India go looking for their first job. Most of them send a resume that looks like everyone
            else&apos;s, and more of them every year are written by the same AI tools. &ldquo;10/10 in React.&rdquo; &ldquo;Team
            player.&rdquo; &ldquo;Expert in AI.&rdquo;
          </p>
          <p>
            Recruiters cannot tell real skill from keyword stuffing, so they fall back on proxies: the college name, the marks, the referral.
            Students who did the work but went to the wrong college never get looked at. Students who did not do the work learn that the
            words are what count.
          </p>
          <p className="font-display text-2xl leading-snug font-semibold tracking-tight text-ink">
            Proof replaces claims with evidence: code you actually wrote, projects that are actually live, checks you actually passed, and
            endorsements from mentors who proved who they are.
          </p>
          <p>
            Each item is verified by a machine, not a form, and becomes a signed credential anyone can check. Recruiters search the evidence.
            Placement cells see who is truly ready. Students get a dossier that speaks for them, for free.
          </p>
          <p className="text-muted">Proof is designed and built by Rutvi Rupani.</p>
        </FadeIn>
      </section>

      <section className="border-y border-line bg-surface-2/50">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <SectionIntro eyebrow="Principles" title="Five rules we do not bend." />
          <Stagger inView className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {PRINCIPLES.map(({ icon: Icon, title, body }) => (
              <StaggerItem key={title} className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-card">
                <Icon className="size-5 text-verified" aria-hidden />
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <SectionIntro eyebrow="A note on the demo" title="Everyone you meet here is fictional.">
          <p>
            The students, colleges, companies and mentors in this build are invented. Their domains use the reserved .example TLD and their
            GitHub names a proofdemo- prefix, so nothing points at a real person or organisation. The verification, scoring and signatures
            are real.
          </p>
        </SectionIntro>
      </section>

      <CtaBand />
    </main>
  );
}
