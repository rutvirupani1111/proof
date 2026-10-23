"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(cb: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/**
 * Reduced-motion preference that is `false` during SSR AND hydration, then the real value. Use it
 * (not motion's useReducedMotion) wherever the preference changes the rendered markup, so a
 * reduced-motion visitor never gets a hydration mismatch.
 */
export function useReducedMotionPref() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
