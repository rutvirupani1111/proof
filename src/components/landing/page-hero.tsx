import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { FadeIn } from "@/components/motion";
import { Button } from "@/components/ui/button";

/** Hero for the secondary marketing pages: eyebrow, display title, lede, two CTAs, optional visual. */
export function PageHero({
  eyebrow,
  title,
  lede,
  primary,
  secondary,
  visual,
}: {
  eyebrow: string;
  title: ReactNode;
  lede: ReactNode;
  primary?: { href: string; label: string };
  secondary?: { href: string; label: string };
  visual?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border-b border-line">
      <div className="absolute inset-0 bg-dots opacity-60 [mask-image:radial-gradient(60%_70%_at_70%_10%,black,transparent)]" aria-hidden />
      <div className={`relative mx-auto grid max-w-6xl gap-12 px-4 pt-14 pb-16 sm:px-6 sm:pt-20 sm:pb-24 ${visual ? "lg:grid-cols-[1.05fr_1fr] lg:items-center" : ""}`}>
        <FadeIn className={visual ? undefined : "max-w-3xl"}>
          <p className="font-mono text-[11px] tracking-[0.16em] text-subtle uppercase">{eyebrow}</p>
          <h1 className="mt-4 text-[2.5rem] leading-[0.98] font-semibold tracking-[-0.04em] text-balance sm:text-6xl">{title}</h1>
          <div className="mt-5 max-w-xl text-pretty text-muted sm:text-lg">{lede}</div>
          {(primary || secondary) && (
            <div className="mt-8 flex flex-wrap gap-3">
              {primary && (
                <Button size="lg" asChild>
                  <Link href={primary.href}>
                    {primary.label} <ArrowRight />
                  </Link>
                </Button>
              )}
              {secondary && (
                <Button size="lg" variant="secondary" asChild>
                  <Link href={secondary.href}>{secondary.label}</Link>
                </Button>
              )}
            </div>
          )}
        </FadeIn>
        {visual && (
          <FadeIn delay={0.12} direction="left" className="mx-auto w-full max-w-xl">
            {visual}
          </FadeIn>
        )}
      </div>
    </section>
  );
}
