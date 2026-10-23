"use client";

import { ArrowRight, Code2, GitBranch, Globe, RotateCcw, Route, Users } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion, useSpring, useTransform } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { springs } from "@/components/motion/transitions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CAPS, SIGNAL_LABEL, computeScore, type Signal } from "@/server/scoring/engine";
import { fromWire, proofPath, simulateProofScore, type WireScoreItem } from "@/server/scoring/simulate";

const ICON = { github: GitBranch, authorship: GitBranch, deployments: Globe, checks: Code2, endorsements: Users, recency: Route } as const;
const SIGNALS = Object.keys(CAPS) as Signal[];

/**
 * Proof Path: the next proofs ranked by what the real scoring engine says they would add.
 * Toggle several to stack them; the dial springs to the simulated score (caps, diminishing
 * returns and recency all applied, so stacked gains are honest, not a naive sum).
 */
export function ProofPath({ items: wire, githubVerified, now: nowIso }: { items: WireScoreItem[]; githubVerified: boolean; now: string }) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const items = useMemo(() => fromWire(wire), [wire]);
  const steps = useMemo(() => proofPath(items, { githubVerified }, now), [items, githubVerified, now]);
  const base = useMemo(() => computeScore(items, now).overall, [items, now]);
  const [picked, setPicked] = useState<string[]>([]);

  const chosen = useMemo(() => steps.filter((s) => picked.includes(s.id)), [steps, picked]);
  const sim = useMemo(() => simulateProofScore(items, chosen.flatMap((s) => s.items), now), [items, chosen, now]);
  const lead = chosen[0] ?? steps[0];
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  if (!steps.length) return null;

  return (
    <Card className="overflow-hidden" aria-labelledby="proof-path-h">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-5 pt-5 pb-4 sm:px-6">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-mono text-[11px] tracking-[0.14em] text-verified uppercase">
            <Route className="size-3.5" aria-hidden /> Proof Path
          </p>
          <h2 id="proof-path-h" className="mt-1 font-display text-xl font-semibold text-balance">
            What would move your score most?
          </h2>
          <p className="mt-1 max-w-xl text-sm text-pretty text-muted">
            Each step is priced by the scoring engine on your real evidence. Stack a few to see the combined result.
          </p>
        </div>
        <AnimatePresence>
          {picked.length > 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={springs.snappy}>
              <Button variant="ghost" size="sm" onClick={() => setPicked([])}>
                <RotateCcw /> Reset
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-[auto_minmax(0,1fr)] md:items-start">
        <div className="mx-auto grid justify-items-center gap-3 md:sticky md:top-20">
          <SimDial base={base} value={sim.after} />
          <p className="text-center text-xs text-muted" aria-live="polite">
            {sim.delta > 0 ? (
              <>
                <span className="font-mono font-semibold text-verified">+{sim.delta}</span> from {chosen.length} step{chosen.length === 1 ? "" : "s"}
              </>
            ) : (
              "Toggle a step to simulate it"
            )}
          </p>
          <ul className="flex max-w-[14rem] flex-wrap justify-center gap-1" aria-label="Gains by signal">
            <AnimatePresence initial={false}>
              {SIGNALS.filter((s) => sim.gains[s] > 0).map((s) => (
                <motion.li
                  key={s}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={springs.snappy}
                  className="rounded-full border border-line bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-muted"
                >
                  {SIGNAL_LABEL[s].split(" ").at(-1)} +{sim.gains[s]}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>

        <div className="grid gap-3">
          <ol className="grid gap-2">
            {steps.map((s, i) => {
              const on = picked.includes(s.id);
              const Icon = ICON[s.signal];
              return (
                <motion.li
                  key={s.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...springs.gentle, delay: 0.04 * i }}
                  className={cn(
                    "flex items-stretch gap-1 rounded-xl border transition-colors",
                    on ? "border-lime/70 bg-verified-soft" : "border-line bg-surface hover:bg-surface-2",
                  )}
                >
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    onClick={() => toggle(s.id)}
                    className="flex min-w-0 flex-1 items-start gap-3 rounded-l-xl p-3 text-left focus-visible:ring-2 focus-visible:ring-violet focus-visible:outline-none"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition-colors",
                        on ? "border-lime bg-lime text-lime-ink" : "border-line-strong bg-surface",
                      )}
                    >
                      <AnimatePresence>
                        {on && (
                          <motion.svg key="tick" viewBox="0 0 12 12" className="size-3" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={springs.stamp}>
                            <path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </motion.svg>
                        )}
                      </AnimatePresence>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        <Icon className="size-3.5 shrink-0 text-subtle" aria-hidden />
                        <span className="truncate">{s.title}</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-pretty text-muted">{s.description}</span>
                    </span>
                    <span className={cn("shrink-0 self-center rounded-full px-2 py-0.5 font-mono text-xs font-semibold tabular", on ? "bg-lime text-lime-ink" : "bg-surface-2 text-verified")}>
                      +{s.delta}
                    </span>
                  </button>
                  <Link
                    href={s.href}
                    aria-label={`${s.cta}: ${s.title}`}
                    className="grid w-11 shrink-0 place-items-center rounded-r-xl border-l border-line text-subtle transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-violet focus-visible:outline-none"
                  >
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </motion.li>
              );
            })}
          </ol>
          {lead && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-line-strong px-4 py-3">
              <p className="min-w-0 text-sm text-muted">
                {chosen.length > 1 ? "Start with the biggest step:" : "Next:"} <span className="font-medium text-ink">{lead.title}</span>
              </p>
              <Button size="sm" asChild>
                <Link href={lead.href}>
                  {lead.cta} <ArrowRight />
                </Link>
              </Button>
            </div>
          )}
          <p className="text-[11px] text-subtle">
            Modelled conservatively on your own record (a repo like your median one, an advanced check at 85/100). Real results depend on the evidence.
          </p>
        </div>
      </div>
    </Card>
  );
}

/** Dial: grey arc is today, lime arc springs to the simulated score, the number follows it. */
function SimDial({ base, value, size = 152 }: { base: number; value: number; size?: number }) {
  const reduce = useReducedMotion();
  const r = 42;
  const c = 2 * Math.PI * r;
  const mv = useSpring(base, { stiffness: 140, damping: 22 });
  const text = useTransform(mv, (v) => String(Math.round(v)));
  const offset = useTransform(mv, (v) => c * (1 - Math.max(0, Math.min(100, v)) / 100));

  useEffect(() => {
    if (reduce) mv.jump(value);
    else mv.set(value);
  }, [mv, value, reduce]);

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="7" />
        <motion.circle cx="50" cy="50" r={r} fill="none" stroke="var(--violet)" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} style={{ strokeDashoffset: offset }} opacity={0.55} />
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--lime)" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - base / 100)} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <motion.div className="font-display text-4xl leading-none font-semibold tracking-tight tabular" aria-label={`Simulated score ${value}`}>
            {text}
          </motion.div>
          <div className="mt-1 font-mono text-[10px] tracking-[0.16em] text-subtle uppercase">{value > base ? `from ${base}` : "today"}</div>
        </div>
      </div>
    </div>
  );
}
