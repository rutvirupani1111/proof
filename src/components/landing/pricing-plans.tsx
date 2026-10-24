"use client";

import { ArrowRight, Check, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { springs } from "@/components/motion/transitions";
import { useCheckout } from "@/components/billing/upgrade-sheet";
import { Button } from "@/components/ui/button";
import { SealGlyph } from "@/components/ui/seal-glyph";
import { useSession } from "@/lib/auth/client";
import { PLANS, formatInr, type PlanId } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

type Card = {
  id: string;
  audience: string;
  name: string;
  monthly: number | null;
  unit: string;
  blurb: string;
  features: string[];
  signup: { href: string; label: string };
  /** Paid plan: signed-in recruiters / colleges go straight to Checkout. */
  planId?: PlanId;
  role?: "recruiter" | "college";
  featured?: boolean;
};

const plan = (id: PlanId, role: "recruiter" | "college", audience: string, featured = false): Card => ({
  id,
  audience,
  name: PLANS[id].name,
  monthly: PLANS[id].monthlyInr,
  unit: PLANS[id].perSeat ? "per seat / month" : "per campus / month",
  blurb: PLANS[id].blurb,
  features: PLANS[id].features,
  signup: { href: `/signup?role=${role}`, label: role === "recruiter" ? "Start hiring" : "Set up your cell" },
  planId: id,
  role,
  featured,
});

const CARDS: Card[] = [
  {
    id: "students",
    audience: "Students",
    name: "Student",
    monthly: null,
    unit: "forever",
    blurb: "Everything a student needs to prove their work and get hired. No trial, no card, no catch.",
    features: ["GitHub ownership, authorship, deployments", "All skill checks, unlimited retries", "Signed credentials + public /verify links", "Job board, applications, messages"],
    signup: { href: "/signup?role=student", label: "Build your Proof" },
  },
  plan("recruiter_starter", "recruiter", "Recruiters"),
  plan("recruiter_growth", "recruiter", "Recruiters", true),
  plan("college_campus", "college", "Colleges"),
];

/** Plan cards. Prices come from the billing catalogue that Stripe is bootstrapped from. */
export function PricingPlans() {
  const { data } = useSession();
  const role = (data?.user as { role?: string } | undefined)?.role;
  const { pending, checkout } = useCheckout();

  return (
    <div>
      <p className="text-center font-mono text-[11px] text-subtle">
        Billed monthly · cancel any time · Recruiter Free includes 5 candidate unlocks a month
      </p>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((p, i) => {
          const canCheckout = !!p.planId && !!p.role && role === p.role;
          return (
            <motion.section
              key={p.id}
              id={p.id}
              aria-labelledby={`plan-${p.id}`}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ ...springs.gentle, delay: i * 0.06 }}
              whileHover={{ y: -4 }}
              className={cn(
                "relative flex scroll-mt-24 flex-col rounded-[1.4rem] border p-6",
                p.featured ? "border-line-strong bg-surface shadow-pop ring-1 ring-lime/40" : "border-line bg-surface shadow-card",
              )}
            >
              {p.featured && (
                <span className="absolute -top-3 left-6 rounded-full bg-ink px-2.5 py-1 font-mono text-[10.5px] tracking-wider text-canvas uppercase">Most teams</span>
              )}
              <p className="font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">{p.audience}</p>
              <h2 id={`plan-${p.id}`} className="mt-2 text-xl font-semibold">
                {p.name}
              </h2>
              <p className="mt-1.5 min-h-[3rem] text-sm text-muted">{p.blurb}</p>
              <div className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-y border-dashed border-line-strong py-5">
                <span className="font-display text-[2.6rem] leading-none font-semibold tracking-tight tabular">{p.monthly ? formatInr(p.monthly) : "₹0"}</span>
                <span className="text-sm text-muted">{p.unit}</span>
              </div>
              <p className={cn("mt-2 font-mono text-[11px]", p.monthly ? "text-subtle" : "text-verified")}>
                {p.monthly ? "billed monthly · + GST" : "Free for students, forever."}
              </p>
              <ul className="mt-5 grid flex-1 gap-2.5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    {p.monthly ? <Check className="mt-0.5 size-4 shrink-0 text-verified" aria-hidden /> : <SealGlyph className="mt-0.5 size-4 shrink-0 text-verified" />}
                    {f}
                  </li>
                ))}
              </ul>
              {canCheckout ? (
                <Button variant={p.featured ? "primary" : "secondary"} className="mt-7 w-full" size="lg" disabled={pending} onClick={() => checkout(p.planId!, 1)}>
                  {pending ? <Loader2 className="animate-spin" /> : null} Choose {p.name.replace(/^(Recruiter|College) /, "")} <ArrowRight />
                </Button>
              ) : (
                <Button asChild variant={p.featured ? "primary" : "secondary"} className="mt-7 w-full" size="lg">
                  <Link href={p.signup.href}>
                    {p.signup.label} <ArrowRight />
                  </Link>
                </Button>
              )}
            </motion.section>
          );
        })}
      </div>
    </div>
  );
}
