import "server-only";

/**
 * Server-Sent Events framing for the live notifications stream. Pure (no I/O) so the wire format
 * and cursor parsing are unit-tested; the stream itself lives in ./stream.ts.
 */

/** How long one stream stays open before it closes itself (under the platform function limit). */
export const STREAM_BUDGET_MS = 45_000;
/** Comment line that keeps proxies from timing the connection out. */
export const HEARTBEAT_MS = 15_000;
/** How often the stream checks for new rows. */
export const POLL_MS = 2_500;
/** Browser reconnect delay after the stream closes (sent as `retry:`). */
export const RETRY_MS = 1_500;
/** Oldest cursor accepted, so a stale tab cannot replay a week of notifications as toasts. */
export const MAX_REPLAY_MS = 10 * 60_000;

/** One SSE frame. Multi-line data is split into several `data:` lines, as the spec requires. */
export function sseEvent(event: string, data: unknown, id?: string): string {
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  const lines = [`event: ${event}`];
  if (id) lines.push(`id: ${id}`);
  for (const line of payload.split(/\r?\n/)) lines.push(`data: ${line}`);
  return `${lines.join("\n")}\n\n`;
}

export function sseComment(text: string): string {
  return `: ${text}\n\n`;
}

export function sseRetry(ms: number): string {
  return `retry: ${Math.max(0, Math.round(ms))}\n\n`;
}

/**
 * The cursor a stream starts from: the browser's `Last-Event-ID` on reconnect (the ISO time of
 * the last notification it received), else the `since` the page was rendered at, else now.
 * Anything unparsable falls through; future or too-old cursors are clamped.
 */
export function resolveCursor(lastEventId: string | null, since: string | null, now: Date): Date {
  const parse = (v: string | null) => {
    if (!v) return null;
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  };
  const t = parse(lastEventId) ?? parse(since) ?? now.getTime();
  return new Date(Math.min(now.getTime(), Math.max(now.getTime() - MAX_REPLAY_MS, t)));
}
