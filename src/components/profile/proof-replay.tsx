"use client";

import { Code2, GitBranch, GitCommitHorizontal, Globe, Pause, Play, RotateCcw, Users } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { springs } from "@/components/motion/transitions";
import { useReducedMotionPref } from "@/components/motion/use-reduced-motion-pref";
import { cn } from "@/lib/utils";
import type { Replay, ReplayKind } from "@/server/scoring/replay";

const W = 560;
const H = 250;
const PAD = 14;
const TOP = 16;
const LINE_H = 118; // score area height
const LANES: Record<ReplayKind, number> = { github: 152, commit: 172, deployment: 194, check: 214, endorsement: 234 };
const META: Record<ReplayKind, { label: string; color: string; icon: typeof Globe }> = {
  commit: { label: "Commits", color: "var(--muted)", icon: GitCommitHorizontal },
  github: { label: "GitHub proven", color: "var(--violet)", icon: GitBranch },
  deployment: { label: "Deployments", color: "var(--violet)", icon: Globe },
  check: { label: "Skill checks", color: "var(--coral)", icon: Code2 },
  endorsement: { label: "Endorsements", color: "var(--lime)", icon: Users },
};
const PLAY_MS = 7000;

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const jitter = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000 - 0.5;
};

/**
 * Proof Replay: scrub or play through the weeks of a student's verified work. Commits,
 * deployments, checks and endorsements light up in sequence while the score line (the real
 * engine, re-run week by week) grows behind them.
 */
export function ProofReplay({ replay }: { replay: Replay }) {
  const { weeks, events } = replay;
  const n = weeks.length;
  const last = Math.max(0, n - 1);
  const reduce = useReducedMotionPref();
  const [t, setT] = useState(last); // SSR and no-JS show the finished picture
  const [playing, setPlaying] = useState(false);
  const raf = useRef<number | null>(null);
  const started = useRef(false);

  const x = useCallback((w: number) => PAD + (last ? w / last : 1) * (W - 2 * PAD), [last]);
  const y = (s: number) => TOP + (1 - s / 100) * LINE_H;

  const linePath = useMemo(() => weeks.map((wk, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(wk.score).toFixed(1)}`).join(""), [weeks, x]);
  const areaPath = `${linePath}L${x(last).toFixed(1)},${TOP + LINE_H}L${x(0).toFixed(1)},${TOP + LINE_H}Z`;
  const maxCommits = useMemo(() => Math.max(1, ...events.filter((e) => e.kind === "commit").map((e) => e.count)), [events]);

  const stop = useCallback(() => {
    if (raf.current != null) cancelAnimationFrame(raf.current);
    raf.current = null;
    setPlaying(false);
  }, []);

  const play = useCallback(
    (from?: number) => {
      if (n < 2) return;
      stop();
      const start = from ?? (t >= last ? 0 : t);
      const t0 = performance.now() - (start / last) * PLAY_MS;
      setPlaying(true);
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / PLAY_MS);
        // Reduced motion: advance in whole weeks, no tweening between them.
        setT(reduce ? Math.floor(p * last) : p * last);
        if (p < 1) raf.current = requestAnimationFrame(tick);
        else {
          raf.current = null;
          setPlaying(false);
        }
      };
      raf.current = requestAnimationFrame(tick);
    },
    [n, last, t, reduce, stop],
  );

  // First time it scrolls into view: rewind and play (motion-friendly visitors only).
  const onEnter = () => {
    if (started.current || reduce) return;
    started.current = true;
    play(0);
  };
  useEffect(() => () => stop(), [stop]);

  if (n < 2) return null;

  const wi = Math.min(last, Math.floor(t + 1e-6));
  const week = (i: number) => weeks[Math.max(0, Math.min(last, i))] ?? { week: 0, start: new Date(0).toISOString(), score: 0, commits: 0 };
  const score = week(wi).score;
  const seen = events.filter((e) => e.week <= wi);
  const tally = {
    commit: seen.filter((e) => e.kind === "commit").reduce((s, e) => s + e.count, 0),
    deployment: seen.filter((e) => e.kind === "deployment").length,
    check: seen.filter((e) => e.kind === "check").length,
    endorsement: seen.filter((e) => e.kind === "endorsement").length,
  };
  const latest = [...seen].reverse().find((e) => e.kind !== "commit") ?? seen.at(-1);
  const head = x(t);

  return (
    <motion.div
      onViewportEnter={onEnter}
      viewport={{ once: true, margin: "-20% 0px" }}
      className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-card"
    >
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line px-4 pt-4 pb-3 sm:px-5">
        <div className="min-w-0">
          <p className="font-mono text-[11px] tracking-[0.14em] text-subtle uppercase">Week of {fmt(week(wi).start)}</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-4xl leading-none font-semibold tabular" aria-live="polite" aria-label={`Proof Score ${score}`}>
              {score}
            </span>
            <span className="text-sm text-muted">Proof Score</span>
          </div>
        </div>
        <dl className="grid grid-cols-4 gap-x-4 gap-y-1 text-right">
          {(["commit", "deployment", "check", "endorsement"] as const).map((k) => (
            <div key={k} className="min-w-0">
              <dt className="truncate font-mono text-[10px] tracking-wider text-subtle uppercase">{META[k].label.split(" ").at(-1)}</dt>
              <dd className="font-display text-lg font-semibold tabular">{tally[k]}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="relative px-1 pt-2 sm:px-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Proof Score grew to ${replay.finalScore} over ${n} weeks of verified work`}>
          <defs>
            <clipPath id="replay-clip">
              <rect x="0" y="0" height={H} width={Math.max(0, head)} />
            </clipPath>
            <linearGradient id="replay-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--lime)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--lime)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 50, 100].map((g) => (
            <g key={g}>
              <line x1={PAD} x2={W - PAD} y1={y(g)} y2={y(g)} stroke="var(--line)" strokeDasharray="2 4" />
              <text x={W - PAD} y={y(g) - 3} textAnchor="end" className="fill-[var(--subtle)] font-mono text-[9px]">
                {g}
              </text>
            </g>
          ))}
          {(Object.keys(LANES) as ReplayKind[]).map((k) => (
            <line key={k} x1={PAD} x2={W - PAD} y1={LANES[k]} y2={LANES[k]} stroke="var(--line)" strokeWidth="0.6" />
          ))}
          {/* Ghost of the whole run, then the revealed part */}
          <path d={linePath} fill="none" stroke="var(--line-strong)" strokeWidth="1.2" strokeDasharray="3 3" />
          <g clipPath="url(#replay-clip)">
            <path d={areaPath} fill="url(#replay-fill)" />
            <path d={linePath} fill="none" stroke="var(--verified)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
          </g>
          {events.map((e) => {
            const on = e.week <= t + 1e-6;
            const cx = x(e.week) + jitter(e.id) * 4;
            const cy = LANES[e.kind] + (e.kind === "commit" ? jitter(`${e.id}y`) * 6 : 0);
            const r = e.kind === "commit" ? 1.6 + 3.2 * Math.sqrt(e.count / maxCommits) : 5;
            return (
              <motion.g
                key={e.id}
                initial={false}
                animate={on ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.2 }}
                transition={reduce ? { duration: 0 } : springs.stamp}
                style={{ transformOrigin: `${cx}px ${cy}px`, transformBox: "view-box" }}
              >
                {e.kind === "commit" ? (
                  <circle cx={cx} cy={cy} r={r} fill={META.commit.color} opacity={0.55} />
                ) : e.kind === "endorsement" ? (
                  <path d={star(cx, cy, 6.5, 2.8)} fill="var(--lime)" stroke="var(--verified)" strokeWidth="0.8" />
                ) : e.kind === "check" ? (
                  <rect x={cx - 4.5} y={cy - 4.5} width="9" height="9" rx="2" fill="var(--coral)" transform={`rotate(45 ${cx} ${cy})`} />
                ) : e.kind === "github" ? (
                  <circle cx={cx} cy={cy} r={4.5} fill="none" stroke="var(--violet)" strokeWidth="2" />
                ) : (
                  <circle cx={cx} cy={cy} r={r} fill="var(--violet)" />
                )}
                {e.kind !== "commit" && <line x1={cx} x2={cx} y1={LANES[e.kind] - 7} y2={y(week(e.week).score)} stroke={META[e.kind].color} strokeWidth="0.6" strokeDasharray="1 3" opacity={0.7} />}
              </motion.g>
            );
          })}
          <line x1={head} x2={head} y1={TOP - 6} y2={H - 6} stroke="var(--ink)" strokeWidth="1" opacity={0.35} />
          <circle cx={head} cy={y(week(wi).score)} r="4" fill="var(--lime)" stroke="var(--ink)" strokeWidth="1.2" />
        </svg>
        <div className="flex justify-between px-3 pb-1 font-mono text-[10px] text-subtle">
          <span>{fmt(week(0).start)}</span>
          <span>Today</span>
        </div>
      </div>

      <div className="grid gap-3 border-t border-line px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => (playing ? stop() : play())}
            aria-label={playing ? "Pause replay" : t >= last ? "Replay from the start" : "Play replay"}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-lime text-lime-ink shadow-card transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-violet focus-visible:outline-none active:scale-95"
          >
            {playing ? <Pause className="size-4" aria-hidden /> : t >= last ? <RotateCcw className="size-4" aria-hidden /> : <Play className="ml-0.5 size-4" aria-hidden />}
          </button>
          <input
            type="range"
            min={0}
            max={last}
            step={1}
            value={wi}
            onChange={(e) => {
              stop();
              setT(Number(e.target.value));
            }}
            aria-label="Scrub through weeks"
            aria-valuetext={`Week of ${fmt(week(wi).start)}, score ${score}`}
            className="h-11 min-w-0 flex-1 cursor-pointer accent-[var(--verified)]"
          />
        </div>
        <div className="flex min-h-5 items-center gap-2 text-sm" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            {latest && (
              <motion.p
                key={latest.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={reduce ? { duration: 0 } : springs.snappy}
                className="flex min-w-0 items-center gap-2"
              >
                {(() => {
                  const Icon = META[latest.kind].icon;
                  return <Icon className={cn("size-4 shrink-0", latest.kind === "endorsement" ? "text-verified" : "text-subtle")} aria-hidden />;
                })()}
                <span className="truncate">
                  <span className="text-muted">{META[latest.kind].label.replace(/s$/, "")}:</span> {latest.title}
                </span>
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-subtle" aria-label="Legend">
          {(["commit", "deployment", "check", "endorsement"] as const).map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: META[k].color }} aria-hidden />
              {META[k].label}
            </li>
          ))}
          <li className="basis-full text-[10px] sm:basis-auto">Commits are spread across each repo&apos;s verified active weeks.</li>
        </ul>
      </div>
    </motion.div>
  );
}

function star(cx: number, cy: number, R: number, r: number) {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 ? r : R;
    d += `${i ? "L" : "M"}${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`;
  }
  return `${d}Z`;
}
