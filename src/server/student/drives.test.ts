/** Student drive registration: own college only, eligibility re-checked in SQL, results visible. */
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db";
import { driveStudents } from "@/db/schema";
import { createTestDb, ids, seedWorld } from "@/server/search/test-fixtures";

const h = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/db")>()),
  getDb: async () => h.db,
}));

const d = await import("./drives");

let db: Db;
let close: () => Promise<void>;
beforeAll(async () => {
  const t = await createTestDb();
  h.db = t.db;
  db = t.db as Db;
  close = t.close;
  await seedWorld(db);
}, 60_000);
afterAll(async () => close?.());

describe("student drive registration", () => {
  it("refuses a drive run by another college", async () => {
    const res = await d.registerForDrive(ids.chirag, ids.driveA);
    expect(res).toEqual({ ok: false, error: "That drive is not run by your college." });
  });

  it("refuses a student below the drive's bar, and says why in the listing", async () => {
    const res = await d.registerForDrive(ids.bhavin, ids.driveA);
    expect(res.ok).toBe(false);
    const list = await d.getStudentDrives(ids.bhavin);
    const drive = list.find((x) => x.id === ids.driveA)!;
    expect(drive.eligible).toBe(false);
    expect(drive.canRegister).toBe(false);
    expect(drive.criteria[0]).toMatchObject({ met: false });
  });

  it("registers an eligible student once", async () => {
    const first = await d.registerForDrive(ids.chirag, ids.driveB);
    expect(first.ok).toBe(true);
    const row = await db.query.driveStudents.findFirst({
      where: and(eq(driveStudents.driveId, ids.driveB), eq(driveStudents.studentUserId, ids.chirag)),
    });
    expect(row?.status).toBe("registered");
    const again = await d.registerForDrive(ids.chirag, ids.driveB);
    expect(again).toEqual({ ok: false, error: "You are already registered for this drive." });
  });

  it("shows results for drives the student is on, never other colleges' drives", async () => {
    const list = await d.getStudentDrives(ids.asha);
    expect(list.map((x) => x.id)).not.toContain(ids.driveB);
    const mine = list.find((x) => x.id === ids.driveA)!;
    expect(mine.rosterStatus).toBe("selected");
    expect(mine.canRegister).toBe(false);
  });
});
