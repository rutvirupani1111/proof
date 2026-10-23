"use client";

import { ArrowRight, Check } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { springs } from "@/components/motion/transitions";
import { Button } from "@/components/ui/button";
import { SealGlyph } from "@/components/ui/seal-glyph";
import { cn } from "@/lib/utils";

type Plan = {
  id: string;
  audience: string;
  name: string;
  /** Monthly INR price; null = free; "custom" = talk to us. */
  monthly: number | null | "custom";
  unit: string;
  blurb: string;
  features: string[];
  cta: { href: string; label: string };
  featured?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "students",
    audience: "Students",
    name: "Student",
    monthly: null,
    unit: "forever",
    blurb: "Everything a student needs to prove their work and get hired. No trial, no card, no catch.",
    features: [
      "GitHub ownership, authorship, deployments",
      "All skill checks, unlimited retries",
      "Signed credentials + public /verify links",
      "Verified dossier with QR and link preview",
      "Job board, applications tracker, messages",
    ],
    cta: { href: "/signup?role=student", label: "Build your Proof" },
  },
  {
    id: "recruiters",
    audience: "Recruiters",
    name: "Hiring team",
    monthly: 6999,
    unit: "per seat / month",
    blurb: "Evidence search and a full pipeline for startups and hiring teams.",
    features: [
      "Evidence search + saved searches",
      "Candidate view and compare (up to 3)",
      "Pipeline kanban, notes and messages",
      "25 skill-check invites per seat / month",
      "Verified company domain + teammates",
    ],
    cta: { href: "/signup?role=recruiter", label: "Start hiring" },
    featured: true,
  },
  {
    id: "colleges",
    audience: "Colleges",
    name: "Placement cell",
    monthly: 4999,
    unit: "per campus / month",
    blurb: "Cohort readiness and evidence-based drives for one campus, unlimited students.",
    features: [
      "Cohort readiness funnel + skills gap",
      "Company drives with verified eligibility",
      "Placement stats with CSV export",
      "Nudges for incomplete proofs",
      "Unlimited students and officers",
    ],
    cta: { href: "/signup?role=college", label: "Set up your cell" },
  },
];

const inr = (n: number) => `₹${new Intl.NumberFormat("en-IN").format(n)}`;

/** Plan cards with a monthly / yearly toggle (yearly = two months free). Prices are illustrative. */
export function PricingPlans() {
  const [yearly, setYearly] = useState(true);
  return (
    <div>
      <div className="flex justify-center">
        <div role="radiogroup" aria-label="Billing period" className="relative inline-flex rounded-full border border-line bg-surface p-1 shadow-card">
          {[
            { v: false, label: "Monthly" },
            { v: true, label: "Yearly · 2 months free" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              role="radio"
              aria-checked={yearly === o.v}
              onClick={() => setYearly(o.v)}
              className={cn("relative rounded-full px-4 py-1.5 text-sm transition-colors", yearly === o.v ? "text-lime-ink" : "text-muted hover:text-ink")}
            >
              {yearly === o.v && <motion.span layoutId="billing-pill" className="absolute inset-0 rounded-full bg-lime" transition={springs.snappy} />}
              <span className="relative">{o.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {PLANS.map((p) => {
          const price =
            p.monthly === null ? "₹0" : p.monthly === "custom" ? "Custom" : inr(yearly ? Math.round((p.monthly * 10) / 12) : p.monthly);
          return (
            <section
              key={p.id}
              id={p.id}
              aria-labelledby={`plan-${p.id}`}
              className={cn(
                "relative flex scroll-mt-24 flex-col rounded-[1.4rem] border p-6 sm:p-7",
                p.featured ? "border-line-strong bg-surface shadow-pop ring-1 ring-lime/40" : "border-line bg-surface shadow-card",
              )}
            >
              {p.featured && (
                <span className="absolute -top-3 left-6 rounded-full bg-ink px-2.5 py-1 font-mono text-[10.5px] tracking-wider text-canvas uppercase">
                  Most teams
                </span>
              )}
              <p className="font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">{p.audience}</p>
              <h2 id={`plan-${p.id}`} className="mt-2 text-2xl font-semibold">
                {p.name}
              </h2>
              <p className="mt-1.5 min-h-[3rem] text-sm text-muted">{p.blurb}</p>
              <div className="mt-5 flex items-baseline gap-2 border-y border-dashed border-line-strong py-5">
                <span className="font-display text-5xl font-semibold tracking-tight tabular">{price}</span>
                <span className="text-sm text-muted">{p.monthly === null ? p.unit : p.unit}</span>
              </div>
              {p.monthly !== null && p.monthly !== "custom" && (
                <p className="mt-2 font-mono text-[11px] text-subtle">
                  {yearly ? `${inr(p.monthly * 10)} billed yearly` : "billed monthly, cancel any time"} · + GST
                </p>
              )}
              {p.monthly === null && <p className="mt-2 font-mono text-[11px] text-verified">Free for students, forever.</p>}
              <ul className="mt-5 grid gap-2.5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    {p.monthly === null ? <SealGlyph className="mt-0.5 size-4 shrink-0 text-verified" /> : <Check className="mt-0.5 size-4 shrink-0 text-verified" aria-hidden />}
                    {f}
                  </li>
                ))}
              </ul>
              <Button asChild variant={p.featured ? "primary" : "secondary"} className="mt-7 w-full" size="lg">
                <Link href={p.cta.href}>
                  {p.cta.label} <ArrowRight />
                </Link>
              </Button>
            </section>
          );
        })}
      </div>
    </div>
  );
}
