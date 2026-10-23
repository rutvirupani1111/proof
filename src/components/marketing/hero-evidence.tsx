"use client";

import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Seal, useStampShake } from "@/components/ui/seal";
import { easeOutQuint } from "@/components/motion/transitions";

const CLAIMS = [
  { claim: "Expert in React and Node.js", proof: "React · 41 own commits across 3 repos, 22 active weeks" },
  { claim: "Built scalable web apps", proof: "Live at tiffin-tracker.example · 200 OK in 182 ms" },
  { claim: "Strong problem solver", proof: "Async JS skill check · 9/9 hidden tests in 14 min" },
];

/** Hero visual: resume claims get struck out and replaced by evidence, then the seal lands. */
export function HeroEvidence() {
  const [scope, shake] = useStampShake();
  return (
    <div ref={scope} className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-[radial-gradient(60%_60%_at_70%_30%,var(--violet-soft),transparent_70%)]" aria-hidden />
      <div className="rounded-[1.5rem] border border-line bg-surface bg-ledger p-5 shadow-pop sm:p-6">
        <div className="flex items-center justify-between border-b border-dashed border-line-strong pb-3">
          <div>
            <p className="font-mono text-[10.5px] tracking-[0.14em] text-subtle uppercase">Candidate dossier</p>
            <p className="font-display text-lg font-semibold">Ishita Varma</p>
          </div>
          <Badge variant="verified" mono>
            score 82
          </Badge>
        </div>
        <ul className="mt-4 grid gap-4">
          {CLAIMS.map((c, i) => (
            <li key={c.claim} className="grid gap-1">
              <span className="relative w-fit text-sm text-subtle">
                {c.claim}
                <motion.span
                  className="absolute top-1/2 left-0 h-px w-full origin-left bg-coral"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.5 + i * 0.35, duration: 0.35, ease: easeOutQuint }}
                  aria-hidden
                />
              </span>
              <motion.span
                className="font-mono text-[13px] leading-snug text-ink"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.75 + i * 0.35, duration: 0.3, ease: easeOutQuint }}
              >
                <span className="mr-1.5 text-verified">✓</span>
                {c.proof}
              </motion.span>
            </li>
          ))}
        </ul>
      </div>
      <div className="absolute -right-3 -bottom-8 sm:-right-8">
        <Seal size={116} stamp="mount" delay={1.9} onLand={shake} />
      </div>
    </div>
  );
}
