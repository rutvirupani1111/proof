"use client";

import { animate, useReducedMotion } from "motion/react";
import { useLayoutEffect, useRef } from "react";

const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");

/**
 * A number that tweens from what is currently on screen to the next value. Reduced motion: jumps
 * straight there.
 *
 * React writes the new value into the span during commit, so the tween is started in a layout
 * effect that puts the on-screen number back before paint (a passive effect showed the final
 * number for a frame, then snapped back and counted up). `shown` tracks the displayed number so
 * a value that changes mid-tween continues from there instead of jumping.
 */
export function AnimatedCount({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  const reduce = useReducedMotion();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const start = shown.current;
    if (reduce || start === value) {
      shown.current = value;
      el.textContent = fmt(value);
      return;
    }
    el.textContent = fmt(start);
    const controls = animate(start, value, {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        shown.current = v;
        el.textContent = fmt(v);
      },
    });
    return () => controls.stop();
  }, [value, reduce]);

  return (
    <span ref={ref} className={className}>
      {fmt(value)}
    </span>
  );
}
