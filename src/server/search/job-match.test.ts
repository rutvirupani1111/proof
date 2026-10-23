import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db";
import { createTestDb, ids, seedWorld } from "./test-fixtures";

const h = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/db")>()),
  getDb: async () => h.db,
}));

const { previewJobMatches } = await import("./engine");

let close: () => Promise<void>;
beforeAll(async () => {
  const t = await createTestDb();
  h.db = t.db;
  close = t.close;
  await seedWorld(t.db as Db);
}, 60_000);
afterAll(async () => close?.());

const ids3 = async (req: Parameters<typeof previewJobMatches>[0]) => {
  const r = await previewJobMatches(req);
  return { total: r.total, who: r.sample.map((s) => s.userId) };
};

describe("job editor live match preview", () => {
  it("with no requirements counts every visible candidate (hidden ones never)", async () => {
    expect(await ids3({ skills: [], minScore: 0 })).toEqual({ total: 3, who: [ids.asha, ids.bhavin, ids.diya] });
  });

  it("honours each required skill's own minimum, not just any evidence", async () => {
    expect(await ids3({ skills: [{ slug: "react", minScore: 0 }], minScore: 0 })).toEqual({ total: 2, who: [ids.asha, ids.diya] });
    expect(await ids3({ skills: [{ slug: "react", minScore: 70 }], minScore: 0 })).toEqual({ total: 1, who: [ids.asha] });
    expect((await ids3({ skills: [{ slug: "react", minScore: 95 }], minScore: 0 })).total).toBe(0);
  });

  it("applies the minimum Proof Score", async () => {
    expect(await ids3({ skills: [], minScore: 55 })).toEqual({ total: 2, who: [ids.asha, ids.bhavin] });
  });

  it("an unknown skill can never match", async () => {
    expect((await ids3({ skills: [{ slug: "cobol", minScore: 10 }], minScore: 0 })).total).toBe(0);
  });

  it("returns at most three avatars", async () => {
    const r = await previewJobMatches({ skills: [], minScore: 0 });
    expect(r.sample.length).toBeLessThanOrEqual(3);
    expect(r.sample[0]).toHaveProperty("name");
  });
});
