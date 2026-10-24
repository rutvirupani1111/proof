import { describe, expect, it } from "vitest";
import { MAX_REPLAY_MS, resolveCursor, sseComment, sseEvent, sseRetry } from "./sse";

describe("SSE framing", () => {
  it("frames an event with id and JSON data", () => {
    expect(sseEvent("notification", { a: 1 }, "2026-10-24T00:00:00.000Z")).toBe(
      'event: notification\nid: 2026-10-24T00:00:00.000Z\ndata: {"a":1}\n\n',
    );
  });

  it("splits multi-line string data into several data lines", () => {
    expect(sseEvent("x", "one\ntwo")).toBe("event: x\ndata: one\ndata: two\n\n");
  });

  it("writes comments and retry hints", () => {
    expect(sseComment("heartbeat")).toBe(": heartbeat\n\n");
    expect(sseRetry(1500.4)).toBe("retry: 1500\n\n");
  });
});

describe("resolveCursor", () => {
  const now = new Date("2026-10-24T12:00:00.000Z");

  it("prefers Last-Event-ID over since", () => {
    expect(resolveCursor("2026-10-24T11:59:00.000Z", "2026-10-24T11:58:00.000Z", now).toISOString()).toBe(
      "2026-10-24T11:59:00.000Z",
    );
  });

  it("falls back to since, then now", () => {
    expect(resolveCursor(null, "2026-10-24T11:58:00.000Z", now).toISOString()).toBe("2026-10-24T11:58:00.000Z");
    expect(resolveCursor("garbage", null, now).getTime()).toBe(now.getTime());
  });

  it("clamps future and too-old cursors", () => {
    expect(resolveCursor("2030-01-01T00:00:00Z", null, now).getTime()).toBe(now.getTime());
    expect(resolveCursor("2020-01-01T00:00:00Z", null, now).getTime()).toBe(now.getTime() - MAX_REPLAY_MS);
  });
});
