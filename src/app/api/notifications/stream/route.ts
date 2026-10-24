import { getCurrentUser } from "@/server/auth/guard";
import { resolveCursor } from "@/server/notifications/sse";
import { notificationStream } from "@/server/notifications/stream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** The stream closes itself at 45 s (STREAM_BUDGET_MS); this is the platform's hard stop. */
export const maxDuration = 60;

/**
 * GET /api/notifications/stream: Server-Sent Events for the signed-in user's own notifications.
 * Session-scoped: the user comes from the session cookie, never from the query string.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in required.", { status: 401 });

  const url = new URL(request.url);
  const cursor = resolveCursor(request.headers.get("last-event-id"), url.searchParams.get("since"), new Date());

  return new Response(notificationStream(user.id, cursor, request.signal), {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
