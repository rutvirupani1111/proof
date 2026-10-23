"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const view = { once: true, margin: "-10% 0px" } as const;

/** Verified skill distribution: students with evidence per skill; the lime segment is 70+. */
export function SkillDistribution({
  rows,
  total,
}: {
  rows: { slug: string; name: string; students: number; strong: number; avgScore: number }[];
  total: number;
}) {
  const reduce = useReducedMotion();
  const max = Math.max(1, ...rows.map((r) => r.students));
  return (
    <figure>
      <figcaption className="sr-only">Students with verified evidence per skill, out of {total}.</figcaption>
      <ul className="grid gap-3">
        {rows.map((r, i) => (
          <li key={r.slug} className="grid grid-cols-[6.5rem_minmax(0,1fr)_4.5rem] items-center gap-3 text-sm sm:grid-cols-[8.5rem_minmax(0,1fr)_5.5rem]">
            <span className="truncate">{r.name}</span>
            <span className="relative h-3 overflow-hidden rounded-full bg-surface-3" aria-hidden>
              <motion.span
                className="absolute inset-y-0 left-0 rounded-full bg-violet/70"
                initial={reduce ? false : { width: 0 }}
                whileInView={{ width: `${(r.students / max) * 100}%` }}
                viewport={view}
                transition={{ type: "spring", stiffness: 140, damping: 24, delay: i * 0.04 }}
              />
              <motion.span
                className="absolute inset-y-0 left-0 rounded-full bg-lime"
                initial={reduce ? false : { width: 0 }}
                whileInView={{ width: `${(r.strong / max) * 100}%` }}
                viewport={view}
                transition={{ type: "spring", stiffness: 140, damping: 24, delay: 0.15 + i * 0.04 }}
              />
            </span>
            <span className="text-right font-mono text-xs text-muted tabular">
              <span className="text-ink">{r.students}</span> · avg {r.avgScore}
              <span className="sr-only">
                {" "}
                students, {r.strong} at 70 or above
              </span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-lime" aria-hidden /> 70+ in that skill
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-violet/70" aria-hidden /> has verified evidence
        </span>
      </div>
    </figure>
  );
}

/** Readiness funnel: each stage is a subset signal; width is share of the cohort. */
export function ReadinessFunnel({ steps }: { steps: { key: string; label: string; n: number }[] }) {
  const reduce = useReducedMotion();
  const total = Math.max(1, steps[0]?.n ?? 1);
  return (
    <ol className="grid gap-2">
      {steps.map((s, i) => {
        const pct = (s.n / total) * 100;
        const last = i === steps.length - 1;
        return (
          <li key={s.key} className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-3">
            <div className="relative h-10 overflow-hidden rounded-xl bg-surface-2">
              <motion.div
                className={cn("absolute inset-y-0 left-0 rounded-xl", last ? "bg-lime" : i === 0 ? "bg-surface-3" : "bg-violet/25")}
                initial={reduce ? false : { width: 0 }}
                whileInView={{ width: `${Math.max(pct, 2)}%` }}
                viewport={view}
                transition={{ type: "spring", stiffness: 120, damping: 22, delay: i * 0.06 }}
              />
              <span className={cn("relative flex h-full items-center px-3 text-sm font-medium", last && pct > 30 && "text-lime-ink")}>{s.label}</span>
            </div>
            <span className="text-right">
              <span className="block font-display text-base font-semibold tabular">{s.n}</span>
              <span className="block font-mono text-[10px] text-subtle tabular">{Math.round(pct)}%</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Skills that open jobs ask for at a bar few students meet yet. */
export function SkillGaps({
  gaps,
  total,
}: {
  gaps: { slug: string; name: string; jobs: number; bar: number; ready: number; share: number }[];
  total: number;
}) {
  const reduce = useReducedMotion();
  return (
    <ul className="grid gap-4">
      {gaps.map((g, i) => (
        <li key={g.slug} className="grid gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium">{g.name}</span>
            <span className="font-mono text-xs text-muted tabular">
              {g.jobs} job{g.jobs === 1 ? "" : "s"} want {g.bar}+
            </span>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-coral-soft" aria-hidden>
            <motion.span
              className="absolute inset-y-0 left-0 rounded-full bg-lime"
              initial={reduce ? false : { width: 0 }}
              whileInView={{ width: `${Math.max(g.share * 100, 1.5)}%` }}
              viewport={view}
              transition={{ type: "spring", stiffness: 140, damping: 24, delay: i * 0.05 }}
            />
          </div>
          <p className="text-xs text-muted">
            <span className="font-medium text-ink">{g.ready}</span> of {total} students meet the bar
            <span className={cn("ml-1", g.share < 0.2 ? "text-coral-text" : "text-subtle")}>({Math.round(g.share * 100)}%)</span>
          </p>
        </li>
      ))}
    </ul>
  );
}
