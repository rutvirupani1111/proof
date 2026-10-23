"use client";

import { motion, useReducedMotion } from "motion/react";
import { NumberTicker } from "@/components/motion";
import { cn } from "@/lib/utils";

/**
 * Proof Score ring: a lime arc over a ruled track with 10 tick marks, the number counting up in
 * the middle. The arc draws once on mount (static for reduced motion).
 */
export function ScoreRing({ score, size = 132, className, label = "Proof Score" }: { score: number; size?: number; className?: string; label?: string }) {
  const reduce = useReducedMotion();
  const r = 42;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  return (
    <div className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`${label}: ${score} out of 100`} className="-rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--line)" strokeWidth="7" />
        {Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 2;
          return (
            <line
              key={i}
              x1={50 + Math.cos(a) * 34}
              y1={50 + Math.sin(a) * 34}
              x2={50 + Math.cos(a) * 31}
              y2={50 + Math.sin(a) * 31}
              stroke="var(--line-strong)"
              strokeWidth="1"
            />
          );
        })}
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="var(--lime)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: reduce ? c * (1 - pct) : c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <NumberTicker value={score} className="block font-display text-[2.1rem] leading-none font-semibold tabular" />
          <span className="mt-1 block font-mono text-[9.5px] tracking-[0.16em] text-subtle uppercase">{label}</span>
        </div>
      </div>
    </div>
  );
}
