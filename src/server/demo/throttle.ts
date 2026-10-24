import "server-only";

/**
 * A small fixed-window limiter for the demo sign-in panel, which skips Better Auth's own sign-in
 * limiter (3 per 10 s). Per instance and in memory: it only stops a single client hammering the
 * one-tap buttons, it is not a security boundary (demo mode is a public showcase).
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, { start: number; n: number }>();

export function allowDemoSignIn(key: string, now = Date.now()): boolean {
  const h = hits.get(key);
  if (!h || now - h.start >= WINDOW_MS) {
    if (hits.size > 5_000) hits.clear();
    hits.set(key, { start: now, n: 1 });
    return true;
  }
  h.n += 1;
  return h.n <= MAX_PER_WINDOW;
}
