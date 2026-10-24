"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, LoaderCircle, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { springs } from "@/components/motion/transitions";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { previewJobMatchesAction } from "@/server/search/actions";
import type { JobMatchPreview } from "@/server/search/engine";
import { AnimatedCount } from "./animated-count";

/**
 * "N verified candidates meet this bar today", live while the recruiter edits a job's requirements.
 * Debounced, and stale responses are dropped so the count never flickers backwards.
 */
export function JobMatchCounter({ skills, minScore }: { skills: { skillSlug: string; minScore: number }[]; minScore: number }) {
  const [data, setData] = useState<JobMatchPreview | null>(null);
  const [settled, setSettled] = useState<string | null>(null);
  const req = useRef(0);
  const key = JSON.stringify([skills.map((s) => [s.skillSlug, s.minScore]), minScore]);
  const loading = settled !== key;

  useEffect(() => {
    const id = ++req.current;
    const t = window.setTimeout(async () => {
      const res = await previewJobMatchesAction({
        skills: skills.map((s) => ({ slug: s.skillSlug, minScore: Math.max(0, Math.min(100, Number(s.minScore) || 0)) })),
        minScore,
      });
      if (id !== req.current) return;
      setSettled(key);
      if (res.ok) setData(res.data);
    }, 280);
    return () => window.clearTimeout(t);
    // `key` captures skills + minScore by value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const total = data?.total ?? 0;
  const searchHref = `/recruiter/search?f=${encodeURIComponent(
    JSON.stringify({ ...(skills.length ? { skills: skills.map((s) => s.skillSlug) } : {}), ...(minScore ? { minScore } : {}) }),
  )}`;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-3 transition-colors",
        data && total === 0 ? "border-coral/40 bg-coral-soft/60" : "border-verified/25 bg-verified-soft/60",
      )}
      aria-live="polite"
      aria-busy={loading}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-surface ring-1 ring-line">
          {loading ? <LoaderCircle className="size-4 animate-spin text-subtle" aria-hidden /> : <Users className="size-4 text-verified" aria-hidden />}
        </span>
        <p className="min-w-0 text-sm leading-snug">
          {data ? (
            <>
              <AnimatedCount value={total} className="font-display text-xl font-semibold text-ink tabular" />{" "}
              <span className="text-muted">verified {total === 1 ? "candidate meets" : "candidates meet"} this bar today</span>
            </>
          ) : (
            <span className="text-muted">Counting verified candidates…</span>
          )}
          {data && total === 0 && <span className="block text-xs text-coral-text">Lower a skill minimum or the Proof Score to widen the pool.</span>}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <ul className="relative flex -space-x-2" aria-label="Top matches">
          <AnimatePresence initial={false} mode="popLayout">
            {(data?.sample ?? []).map((p, i) => (
              <motion.li
                key={p.userId}
                layout
                initial={{ opacity: 0, scale: 0.6, x: -6 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ ...springs.snappy, delay: i * 0.04 }}
                className="rounded-full ring-2 ring-surface"
                title={p.name}
              >
                <Avatar name={p.name} src={p.image} size="sm" />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        {total > 0 && (
          <Link href={searchHref} target="_blank" className="inline-flex min-h-9 items-center gap-1 text-xs font-medium text-ink underline-offset-4 hover:underline">
            See them <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>
    </div>
  );
}
