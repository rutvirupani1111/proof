"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect } from "react";
import { springs } from "@/components/motion/transitions";
import { NumberTicker } from "@/components/motion/number-ticker";
import { Button } from "@/components/ui/button";
import { Seal, useStampShake } from "@/components/ui/seal";

export type SealMomentData = {
  title: string;
  detail?: string;
  credentialId?: string;
  previousScore?: number;
  score?: number;
};

/**
 * The verification moment: a card rises, the seal stamps onto it with a spring overshoot and a
 * haptic-like shake, and the Proof Score ticks up. Shown after every successful verification.
 */
export function SealMoment({ data, onClose }: { data: SealMomentData | null; onClose: () => void }) {
  const [scope, shake] = useStampShake();

  useEffect(() => {
    if (!data) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [data, onClose]);

  const delta = data && data.score != null && data.previousScore != null ? data.score - data.previousScore : 0;

  return (
    <AnimatePresence>
      {data && (
        <motion.div
          className="fixed inset-0 z-[60] grid place-items-center bg-overlay p-4 backdrop-blur-[3px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="seal-moment-title"
        >
          <motion.div
            ref={scope}
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 24, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            transition={springs.gentle}
            className="relative w-full max-w-sm overflow-hidden rounded-[var(--radius-card)] border border-verified/40 bg-surface bg-ledger p-6 pt-8 text-center shadow-pop ring-1 ring-lime/30"
          >
            <div className="mx-auto mb-4 grid place-items-center">
              <Seal size={112} stamp="mount" delay={0.18} onLand={shake} label="Verified · Proof · Signed ·" />
            </div>
            <p className="font-mono text-[11px] tracking-[0.16em] text-subtle uppercase">Evidence verified</p>
            <h2 id="seal-moment-title" className="mt-1.5 font-display text-xl font-semibold text-balance">
              {data.title}
            </h2>
            {data.detail && <p className="mt-2 text-sm text-pretty text-muted">{data.detail}</p>}
            {data.score != null && (
              <div className="mx-auto mt-5 flex w-fit items-baseline gap-2 rounded-2xl border border-line bg-surface-2 px-4 py-2">
                <span className="font-mono text-[11px] tracking-wider text-subtle uppercase">Proof Score</span>
                <span className="font-display text-2xl font-semibold text-verified tabular">
                  <NumberTicker value={data.score} />
                </span>
                {delta > 0 && (
                  <motion.span
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...springs.snappy, delay: 0.6 }}
                    className="font-mono text-xs font-semibold text-verified"
                  >
                    +{delta}
                  </motion.span>
                )}
              </div>
            )}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              {data.credentialId && (
                <Button variant="secondary" asChild>
                  <Link href={`/verify/${data.credentialId}`} target="_blank">
                    View signed credential
                  </Link>
                </Button>
              )}
              <Button onClick={onClose} autoFocus>
                Done
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
