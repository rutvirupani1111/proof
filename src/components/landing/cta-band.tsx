import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { FadeIn } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Seal } from "@/components/ui/seal";

/** Closing call to action on an ink panel (dark island in both themes). */
export function CtaBand({
  title = "Show the work. Get the seal.",
  body = "Free for students, forever. Your first seal takes about ten minutes.",
  primary = { href: "/signup?role=student", label: "Build your Proof" },
  secondary = { href: "/for-recruiters", label: "Hire on evidence" },
}: {
  title?: string;
  body?: string;
  primary?: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
      <FadeIn inView>
        <div data-theme="dark" className="relative overflow-hidden rounded-[1.75rem] border border-line bg-canvas px-6 py-14 text-ink shadow-pop sm:px-12 sm:py-16">
          <div className="absolute inset-0 bg-dots opacity-40 [mask-image:radial-gradient(60%_70%_at_80%_50%,black,transparent)]" aria-hidden />
          <div className="absolute -top-24 -left-24 size-72 rounded-full bg-violet/25 blur-3xl" aria-hidden />
          <div className="relative grid items-center gap-10 md:grid-cols-[1fr_auto]">
            <div>
              <h2 className="max-w-2xl text-4xl leading-[1.02] font-semibold tracking-[-0.035em] text-balance sm:text-5xl">{title}</h2>
              <p className="mt-4 max-w-xl text-muted sm:text-lg">{body}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" asChild>
                  <Link href={primary.href}>
                    {primary.label} <ArrowRight />
                  </Link>
                </Button>
                <Button size="lg" variant="secondary" asChild>
                  <Link href={secondary.href}>{secondary.label}</Link>
                </Button>
              </div>
            </div>
            <div className="hidden md:block">
              <Seal size={168} stamp="inView" label="Show the work · get the seal ·" />
            </div>
          </div>
        </div>
      </FadeIn>
    </section>
  );
}
