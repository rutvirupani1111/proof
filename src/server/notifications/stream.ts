import "server-only";
import { getNotificationsSince } from "./queries";
import { HEARTBEAT_MS, POLL_MS, RETRY_MS, STREAM_BUDGET_MS, sseComment, sseEvent, sseRetry } from "./sse";

/**
 * A live notifications stream for one signed-in user. Serverless instances share nothing, so it
 * polls the user's own rows (indexed on user_id, created_at) instead of an in-memory bus: a
 * recruiter's message written on one instance reaches a student connected to another.
 *
 * It closes itself after `STREAM_BUDGET_MS` (before the platform stops the function) with a `bye`
 * event; EventSource reconnects on its own after `retry`, sending `Last-Event-ID`, so nothing is
 * lost across the gap. It stops polling as soon as the client disconnects.
 */
export function notificationStream(userId: string, cursor: Date, signal: AbortSignal): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const started = Date.now();
      let lastBeat = started;
      let since = cursor;

      const send = (chunk: string) => {
        if (!closed) controller.enqueue(enc.encode(chunk));
      };
      const close = () => {
        if (closed) return;
        closed = true;
        if (timer) clearTimeout(timer);
        try {
          controller.close();
        } catch {
          // Already closed by the runtime.
        }
      };
      signal.addEventListener("abort", close, { once: true });

      send(sseRetry(RETRY_MS));
      send(sseEvent("ready", { since: since.toISOString() }));

      const tick = async () => {
        if (closed) return;
        try {
          const { items, unreadCount } = await getNotificationsSince(userId, since);
          for (const item of items) {
            send(sseEvent("notification", { item, unreadCount }, item.createdAt));
            since = new Date(item.createdAt);
          }
        } catch {
          // A failed poll is retried on the next tick; the stream stays up.
        }
        const now = Date.now();
        if (now - lastBeat >= HEARTBEAT_MS) {
          send(sseComment("heartbeat"));
          lastBeat = now;
        }
        if (now - started >= STREAM_BUDGET_MS) {
          send(sseEvent("bye", { reconnect: true }));
          close();
          return;
        }
        timer = setTimeout(tick, POLL_MS);
      };
      timer = setTimeout(tick, POLL_MS);
    },
    cancel() {
      closed = true;
      if (timer) clearTimeout(timer);
    },
  });
}
