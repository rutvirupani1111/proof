import type { Transition } from "motion/react";

/**
 * Motion vocabulary. Purposeful, 150-400 ms, spring-based. Reduced motion is handled globally
 * by <MotionProvider> (MotionConfig reducedMotion="user") and the CSS media query in globals.css.
 */
export const springs = {
  /** Buttons, toggles, small UI. */
  snappy: { type: "spring", stiffness: 520, damping: 36, mass: 0.7 },
  /** Cards and panels entering. */
  gentle: { type: "spring", stiffness: 260, damping: 30 },
  /** Layout re-sorts (search results, kanban). */
  layout: { type: "spring", stiffness: 380, damping: 34 },
  /** The seal landing on a card: overshoots, then settles. */
  stamp: { type: "spring", stiffness: 700, damping: 18, mass: 0.9 },
} satisfies Record<string, Transition>;

export const durations = { fast: 0.15, base: 0.24, slow: 0.4 } as const;

export const easeOutQuint = [0.22, 1, 0.36, 1] as const;
