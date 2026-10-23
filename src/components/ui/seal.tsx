"use client";

import { motion, useAnimate, useReducedMotion } from "motion/react";
import { useCallback, useId } from "react";
import { cn } from "@/lib/utils";
import { springs } from "@/components/motion/transitions";
import { useReducedMotionPref } from "@/components/motion/use-reduced-motion-pref";
import { rosettePath } from "./seal-glyph";

export { SealGlyph } from "./seal-glyph";

const EDGE = rosettePath(50, 50, 49, 45.5, 36);

export type SealProps = {
  /** Pixel size of the seal. */
  size?: number;
  /** Text running around the rim. Keep it short and uppercase-friendly. */
  label?: string;
  /** "mount": stamps on first render; "inView": when scrolled into view; false: static. */
  stamp?: "mount" | "inView" | false;
  /** Called the moment the seal lands; pair with useStampShake() to jolt the card. */
  onLand?: () => void;
  delay?: number;
  className?: string;
  /** Scale the stamp drops in from. Lower it where the seal sits near a clipping edge. */
  stampFrom?: number;
  title?: string;
};

/**
 * The verified seal. Lime rosette, ink rim text, check at the centre. Verified states always
 * use this (or SealGlyph inline). The stamp: drops in large and rotated, overshoots on a stiff
 * spring, settles at -8deg, and a faint ink ring bursts outward.
 */
export function Seal({
  size = 96,
  label = "Verified evidence · Proof ·",
  stamp = false,
  onLand,
  delay = 0,
  className,
  title = "Verified",
  stampFrom = 2.4,
}: SealProps) {
  const pathId = useId();
  // Hydration-safe: the stamp markup differs with the preference, so it must match the server first.
  const reduce = useReducedMotionPref();
  const animated = stamp && !reduce;

  const target = { scale: 1, opacity: 1, rotate: -8 };
  const trigger = animated
    ? stamp === "inView"
      ? { whileInView: target, viewport: { once: true, margin: "-15% 0px" } }
      : { animate: target }
    : {};

  return (
    <div className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }}>
      {animated && (
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full border-2 border-lime"
          initial={{ scale: 0.7, opacity: 0 }}
          {...(stamp === "inView"
            ? { whileInView: { scale: 1.55, opacity: [0, 0.55, 0] }, viewport: { once: true, margin: "-15% 0px" } }
            : { animate: { scale: 1.55, opacity: [0, 0.55, 0] } })}
          transition={{ duration: 0.5, delay: delay + 0.12, ease: "easeOut" }}
        />
      )}
      <motion.svg
        key={animated ? "stamp" : "still"}
        viewBox="0 0 100 100"
        width={size}
        height={size}
        role="img"
        aria-label={title}
        initial={animated ? { scale: stampFrom, opacity: 0, rotate: -32 } : { rotate: -8 }}
        {...trigger}
        transition={{ ...springs.stamp, delay, opacity: { duration: 0.12, delay } }}
        onAnimationComplete={() => onLand?.()}
        className="drop-shadow-[0_6px_14px_rgb(0_0_0/0.18)]"
      >
        <title>{title}</title>
        <defs>
          <path id={pathId} d="M50,50 m-35,0 a35,35 0 1,1 70,0 a35,35 0 1,1 -70,0" />
        </defs>
        <path d={EDGE} fill="var(--lime)" />
        <circle cx="50" cy="50" r="41" fill="none" stroke="var(--lime-ink)" strokeOpacity="0.85" strokeWidth="1.2" />
        <circle cx="50" cy="50" r="27.5" fill="none" stroke="var(--lime-ink)" strokeOpacity="0.85" strokeWidth="1.2" />
        <text
          fill="var(--lime-ink)"
          fontSize="8.4"
          fontWeight="700"
          letterSpacing="1.6"
          style={{ fontFamily: "var(--font-mono)", textTransform: "uppercase" }}
        >
          <textPath href={`#${pathId}`} startOffset="0">
            {label} {label}
          </textPath>
        </text>
        <path
          d="M38.5 50.5l8 8 15-16"
          fill="none"
          stroke="var(--lime-ink)"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </motion.svg>
    </div>
  );
}

/**
 * Haptic-like jolt for the element a seal lands on.
 *   const [scope, shake] = useStampShake();
 *   <div ref={scope}><Seal stamp="mount" onLand={shake} /></div>
 */
export function useStampShake<T extends HTMLElement = HTMLDivElement>() {
  const [scope, animate] = useAnimate<T>();
  const reduce = useReducedMotion();
  const shake = useCallback(() => {
    if (reduce || !scope.current) return;
    animate(
      scope.current,
      { x: [0, -3, 3, -2, 1, 0], y: [0, 1, -1, 0], scale: [1, 0.992, 1] },
      { duration: 0.32, ease: "easeOut" },
    );
  }, [animate, reduce, scope]);
  return [scope, shake] as const;
}
