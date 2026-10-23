"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/** Proof Score as a ledger ring: lime when job-ready (70+), violet in progress, muted below 40. */
export function ScoreRing({
  score,
  size = 56,
  label = "Proof Score",
  className,
}: {
  score: number;
  size?: number;
  label?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const stroke = size >= 72 ? 6 : 4.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const tone = score >= 70 ? "var(--lime)" : score >= 40 ? "var(--violet)" : "var(--line-strong)";
  return (
    <div
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label} ${score} of 100`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={reduce ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ type: "spring", stiffness: 120, damping: 22 }}
        />
      </svg>
      <span
        className={cn(
          "absolute font-display font-semibold tabular tracking-tight",
          size >= 72 ? "text-2xl" : "text-[15px]",
          score >= 70 && "text-verified",
        )}
      >
        {score}
      </span>
    </div>
  );
}
