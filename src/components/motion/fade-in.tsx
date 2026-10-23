"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import { durations, easeOutQuint } from "./transitions";

type Direction = "up" | "down" | "left" | "right" | "none";

const offset: Record<Direction, { x?: number; y?: number }> = {
  up: { y: 12 },
  down: { y: -12 },
  left: { x: 16 },
  right: { x: -16 },
  none: {},
};

export type FadeInProps = HTMLMotionProps<"div"> & {
  direction?: Direction;
  delay?: number;
  /** Animate when scrolled into view instead of on mount. */
  inView?: boolean;
};

export function FadeIn({ direction = "up", delay = 0, inView = false, ...props }: FadeInProps) {
  const from = { opacity: 0, ...offset[direction] };
  const to = { opacity: 1, x: 0, y: 0 };
  return (
    <motion.div
      initial={from}
      {...(inView
        ? { whileInView: to, viewport: { once: true, margin: "-10% 0px" } }
        : { animate: to })}
      transition={{ duration: durations.slow, ease: easeOutQuint, delay }}
      {...props}
    />
  );
}
