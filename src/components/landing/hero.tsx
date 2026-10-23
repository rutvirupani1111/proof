"use client";

import { ArrowDown, ArrowRight } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotionPref } from "@/components/motion/use-reduced-motion-pref";
import { useTheme } from "@/components/theme/theme-provider";
import { Button } from "@/components/ui/button";
import { rosettePath, SealGlyph } from "@/components/ui/seal-glyph";
import type { Exclusion } from "./hero-canvas";

// The 3D scene is its own chunk, fetched after first paint and only when it will actually run.
const HeroCanvas = dynamic(() => import("./hero-canvas"), { ssr: false });

const CLAIM_COUNT = 14;

/** Phones get the static hero: copy first, constellation below, no scroll runway. */
const PHONE_QUERY = "(max-width: 639px)";

/**
 * Landing hero. The headline is plain server-rendered HTML (it is the LCP element); the R3F
 * scene loads lazily behind it. Scrolling the 220svh runway drives the claims-to-seals collapse.
 * Phones, reduced motion, Save-Data or no WebGL: a static constellation of seals instead, no runway.
 * The copy block is measured and handed to the scene as an exclusion zone, so no claim card or
 * seal ever sits under the headline, paragraph or buttons at any width.
 */
export function Hero({ featured }: { featured?: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const [exclude, setExclude] = useState<Exclusion | null>(null);
  const reduce = useReducedMotionPref();
  const { resolved } = useTheme();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [mode, setMode] = useState<"pending" | "3d" | "static">("pending");
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (reduce) return;
    const ric: (cb: () => void) => number =
      typeof window.requestIdleCallback === "function" ? (cb) => window.requestIdleCallback(cb, { timeout: 1200 }) : (cb) => window.setTimeout(cb, 250);
    const cancel = typeof window.cancelIdleCallback === "function" ? window.cancelIdleCallback : window.clearTimeout;
    const handle = ric(() => {
      const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
      let gl = false;
      try {
        const c = document.createElement("canvas");
        gl = !!(c.getContext("webgl2") ?? c.getContext("webgl"));
      } catch {
        gl = false;
      }
      const phone = window.matchMedia(PHONE_QUERY).matches;
      setMode(!phone && !conn?.saveData && gl ? "3d" : "static");
    });
    return () => cancel(handle);
  }, [reduce]);

  useEffect(() => {
    if (mode !== "3d") return;
    const stage = stageRef.current;
    const copy = copyRef.current;
    if (!stage || !copy) return;
    const measure = () => {
      const st = stage.getBoundingClientRect();
      const kids = Array.from(copy.children).map((k) => k.getBoundingClientRect()).filter((r) => r.height > 0);
      if (!kids.length || !st.width || !st.height) return;
      const box = copy.getBoundingClientRect();
      const cs = getComputedStyle(copy);
      const left = box.left + parseFloat(cs.paddingLeft);
      const right = box.right - parseFloat(cs.paddingRight);
      const top = Math.min(...kids.map((r) => r.top));
      const bottom = Math.max(...kids.map((r) => r.bottom));
      const round = (v: number) => Math.round(v * 1000) / 1000;
      const next: Exclusion = {
        x0: round((left - st.left) / st.width - 0.5),
        x1: round((right - st.left) / st.width - 0.5),
        y0: round(0.5 - (bottom - st.top) / st.height),
        y1: round(0.5 - (top - st.top) / st.height),
      };
      setExclude((prev) =>
        prev && prev.x0 === next.x0 && prev.x1 === next.x1 && prev.y0 === next.y0 && prev.y1 === next.y1 ? prev : next,
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    ro.observe(copy);
    return () => ro.disconnect();
  }, [mode]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting), { rootMargin: "100px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const strike = useTransform(scrollYProgress, [0.06, 0.32], [0, 1]);
  const sealsMv = useTransform(scrollYProgress, [0.12, 0.92], [0, CLAIM_COUNT], { clamp: true });
  const sealsText = useTransform(sealsMv, (v) => String(Math.round(v)).padStart(2, "0"));
  const claimsText = useTransform(sealsMv, (v) => String(CLAIM_COUNT - Math.round(v)).padStart(2, "0"));
  const cue = useTransform(scrollYProgress, [0, 0.12], [1, 0]);
  const showStatic = reduce || mode === "static";

  return (
    <section ref={ref} className={showStatic ? "relative" : "relative h-[220svh]"} aria-label="Introduction">
      <div ref={stageRef} className={showStatic ? "relative" : "sticky top-0 h-svh overflow-hidden"}>
        <div className="absolute inset-0 bg-dots opacity-60 [mask-image:radial-gradient(70%_60%_at_60%_30%,black,transparent)]" aria-hidden />
        {mode === "3d" && !reduce && (
          <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
            <HeroCanvas progress={scrollYProgress} dark={resolved === "dark"} active={visible} exclude={exclude} />
          </motion.div>
        )}

        <div className={showStatic ? "relative mx-auto grid max-w-6xl gap-10 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:pt-20" : "relative mx-auto h-full max-w-6xl px-4 sm:px-6"}>
          <div
            ref={copyRef}
            className={
              showStatic
                ? "relative"
                : "relative z-10 -mx-4 bg-[linear-gradient(to_bottom,var(--canvas)_62%,transparent)] px-4 pt-20 pb-10 sm:-mx-6 sm:px-6 sm:pt-24 lg:mx-0 lg:max-w-[38rem] lg:bg-none lg:px-0 lg:pt-[18vh]"
            }
          >
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface/80 px-3 py-1 font-mono text-[11px] tracking-wider text-muted uppercase backdrop-blur">
              <SealGlyph className="size-3.5 text-verified" /> Hiring on verified work
            </p>
            <h1 className="font-display text-[2.55rem] leading-[0.98] font-semibold tracking-[-0.04em] text-balance sm:text-6xl lg:text-[4.6rem]">
              Resumes are{" "}
              <span className="relative inline-block">
                claims.
                <motion.span
                  aria-hidden
                  className="absolute top-[55%] left-[-3%] h-[0.09em] w-[106%] origin-left rounded-full bg-coral"
                  style={{ scaleX: reduce ? 1 : strike }}
                />
              </span>
              <br />
              <span className="relative inline-block">
                <span className="relative z-10">Proof is evidence.</span>
                <span className="absolute inset-x-0 bottom-[0.06em] h-[0.3em] -skew-x-6 bg-lime/80 dark:bg-lime/30" aria-hidden />
              </span>
            </h1>
            <p className="mt-5 max-w-lg text-[15px] text-pretty text-muted sm:mt-6 sm:text-lg">
              <span className="sm:hidden">Code you wrote, projects that are live, checks you passed. Verified, signed, searchable.</span>
              <span className="hidden sm:inline">
                About a crore graduates a year apply with near-identical, AI-polished resumes. Proof turns real work into verified,
                signed evidence: code you actually wrote, projects that are actually live, checks you actually passed.
              </span>
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5 sm:mt-8 sm:gap-3">
              <Button size="lg" asChild>
                <Link href="/signup?role=student">
                  Build your Proof <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <Link href="/for-recruiters">I&apos;m hiring</Link>
              </Button>
            </div>
            {featured}
          </div>

          {showStatic && <StaticConstellation />}
        </div>

        {!showStatic && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
            <div className="mx-auto flex max-w-6xl items-end justify-between px-4 pb-5 sm:px-6 sm:pb-7">
              <p className="rounded-full border border-line bg-surface/85 px-3 py-1.5 font-mono text-[11px] text-muted shadow-card backdrop-blur" aria-hidden>
                <span className="text-coral-text">
                  <motion.span>{claimsText}</motion.span> claims
                </span>
                <span className="mx-2 text-subtle">→</span>
                <span className="text-verified">
                  <motion.span>{sealsText}</motion.span> seals
                </span>
              </p>
              <motion.p style={{ opacity: cue }} className="hidden items-center gap-1.5 font-mono text-[11px] text-subtle sm:flex" aria-hidden>
                Scroll to verify <ArrowDown className="size-3.5 animate-bounce" />
              </motion.p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

const STARS: [number, number][] = [
  [-0.86, 0.52], [-0.52, 0.72], [-0.18, 0.46], [0.16, 0.66], [0.52, 0.86], [0.86, 0.5], [0.62, 0.12],
  [0.22, 0.04], [-0.3, -0.04], [-0.72, -0.24], [-0.4, -0.62], [0.02, -0.5], [0.46, -0.36], [0.82, -0.78],
];
const EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 2], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 6], [12, 13], [8, 11],
];
const SEAL = rosettePath(0, 0, 13, 12, 18);

/** The end state of the hero, drawn statically: seals joined into a constellation. */
function StaticConstellation() {
  const pt = (i: number) => {
    const [x, y] = STARS[i]!;
    return { x: 200 + x * 170, y: 160 - y * 130 };
  };
  return (
    <svg viewBox="0 0 400 320" className="mx-auto w-full max-w-md" role="img" aria-label="Fourteen verified seals joined as a constellation">
      {EDGES.map(([a, b]) => {
        const p = pt(a);
        const q = pt(b);
        return <line key={`${a}-${b}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="var(--verified)" strokeOpacity={0.5} strokeWidth={1.2} />;
      })}
      {STARS.map((_, i) => {
        const p = pt(i);
        return (
          <g key={i} transform={`translate(${p.x} ${p.y}) rotate(-8)`}>
            <path d={SEAL} fill="var(--lime)" stroke="var(--lime-ink)" strokeOpacity={0.25} />
            <path d="M-4.5 0.5l3 3 6-6.5" fill="none" stroke="var(--lime-ink)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );
      })}
    </svg>
  );
}
