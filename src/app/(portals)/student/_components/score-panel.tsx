"use client";

import { HelpCircle } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { springs } from "@/components/motion/transitions";
import { NumberTicker } from "@/components/motion/number-ticker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SealGlyph } from "@/components/ui/seal-glyph";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type Breakdown = {
  authorship: number;
  deployments: number;
  checks: number;
  endorsements: number;
  recency: number;
  reasons: string[];
};
export type SkillRow = { name: string; slug: string; score: number; evidenceCount: number };

const SIGNALS = [
  { key: "authorship", label: "Code authorship", cap: 35, hint: "Own commits, active weeks and authorship share across verified repos." },
  { key: "deployments", label: "Live deployments", cap: 20, hint: "Sites proven with a meta tag or proof.txt, scored by current health." },
  { key: "checks", label: "Skill checks", cap: 25, hint: "Best passing attempt per check, weighted by level." },
  { key: "endorsements", label: "Mentor endorsements", cap: 20, hint: "Verified mentors; repeat endorsements by one mentor count less." },
  { key: "recency", label: "Recency", cap: 10, hint: "Halves every 90 days since your newest evidence." },
] as const;

/** The ring: lime arc drawn with a spring, score ticks up in the middle. */
export function ScoreDial({ score, size = 168 }: { score: number; size?: number }) {
  const reduce = useReducedMotion();
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="7" />
        {Array.from({ length: 20 }, (_, i) => (
          <line key={i} x1="50" y1="2.5" x2="50" y2="5.5" stroke="var(--line-strong)" strokeWidth="0.8" transform={`rotate(${i * 18} 50 50)`} />
        ))}
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="var(--lime)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: reduce ? c * (1 - score / 100) : c }}
          animate={{ strokeDashoffset: c * (1 - score / 100) }}
          transition={{ type: "spring", stiffness: 60, damping: 18, delay: 0.15 }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-display text-5xl leading-none font-semibold tracking-tight tabular">
            <NumberTicker value={score} />
          </div>
          <div className="mt-1 font-mono text-[10px] tracking-[0.18em] text-subtle uppercase">of 100</div>
        </div>
      </div>
    </div>
  );
}

/** "Why 83?": every point attributed to a capped signal, plus the engine's own reasons. */
export function WhyDrawer({ score, breakdown, skills }: { score: number; breakdown: Breakdown; skills: SkillRow[] }) {
  const lines = breakdown.reasons.filter((r) => !/^(Code authorship|Live deployments|Skill checks|Mentor endorsements|Recency):/.test(r));
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="secondary" size="sm">
          <HelpCircle /> Why {score}?
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[min(28rem,100vw)] overflow-y-auto">
        <div className="border-b border-line p-5 pr-12">
          <p className="font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">Proof Score, explained</p>
          <SheetTitle className="mt-1 font-display text-2xl font-semibold">Why {score}?</SheetTitle>
          <SheetDescription className="mt-1 text-sm text-muted">
            Five signals, each with a cap. Nothing here is self-reported; every point traces to verified evidence.
          </SheetDescription>
        </div>
        <div className="grid gap-5 p-5">
          <ol className="grid gap-4">
            {SIGNALS.map((s, i) => {
              const value = breakdown[s.key];
              return (
                <motion.li
                  key={s.key}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...springs.gentle, delay: 0.05 * i }}
                  className="grid gap-1.5"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium">{s.label}</span>
                    <span className="font-mono text-sm tabular">
                      <span className={cn(value > 0 ? "text-verified" : "text-subtle")}>+{value}</span>
                      <span className="text-subtle"> / {s.cap}</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                    <motion.div
                      className="h-full rounded-full bg-lime"
                      initial={{ width: 0 }}
                      animate={{ width: `${(value / s.cap) * 100}%` }}
                      transition={{ ...springs.gentle, delay: 0.1 + 0.05 * i }}
                    />
                  </div>
                  <p className="text-xs text-muted">{s.hint}</p>
                </motion.li>
              );
            })}
          </ol>
          <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-4 py-3">
            <span className="font-mono text-[11px] tracking-wider text-subtle uppercase">Total</span>
            <span className="font-display text-xl font-semibold text-verified tabular">{score}</span>
          </div>
          {lines.length > 0 && (
            <section>
              <h3 className="mb-2 font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">The evidence behind it</h3>
              <ul className="grid gap-2 bg-ledger">
                {lines.map((r) => (
                  <li key={r} className="flex gap-2 text-sm text-pretty">
                    {r.startsWith("Not counted") ? (
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-coral" aria-hidden />
                    ) : (
                      <SealGlyph className="mt-0.5 size-4 shrink-0 text-verified" />
                    )}
                    <span className={cn(r.startsWith("Not counted") && "text-coral-text")}>{r}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {skills.length > 0 && (
            <section>
              <h3 className="mb-2 font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">Per skill</h3>
              <ul className="grid gap-2">
                {skills.map((s) => (
                  <li key={s.slug} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{s.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-subtle">{s.evidenceCount} evidence</span>
                      <Badge variant={s.score >= 60 ? "verified" : "neutral"} mono>
                        {s.score}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
