/**
 * Scope isolation: a recruiter never reads or writes another company's pipeline, lists, searches,
 * jobs or notes; a placement officer only ever sees their own college.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db";
import { notifications, pipelineCards } from "@/db/schema";
import { positionBetween } from "@/app/(portals)/recruiter/pipeline/position";
import { createTestDb, ids, seedWorld } from "./test-fixtures";

const h = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/db")>()),
  getDb: async () => h.db,
}));

const q = await import("@/server/recruiter/queries");
const m = await import("@/server/recruiter/mutations");
const { ScopeError } = await import("@/server/recruiter/scope");
const cq = await import("@/server/college/queries");
const cm = await import("@/server/college/mutations");
const msg = await import("@/server/messaging/queries");

const kite = { userId: ids.recruiterK, companyId: ids.companyK };
const monsoon = { userId: ids.recruiterM, companyId: ids.companyM };
const alpha = { userId: ids.officerA, collegeId: ids.collegeA };
const beta = { userId: ids.officerB, collegeId: ids.collegeB };

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

describe("recruiter scope", () => {
  it("the board only ever contains the company's own cards", async () => {
    expect((await q.getPipelineBoard(kite)).map((c) => c.id)).toEqual([ids.cardK]);
    expect((await q.getPipelineBoard(monsoon)).map((c) => c.id)).toEqual([ids.cardM]);
    // Even when filtering by another company's job id.
    expect(await q.getPipelineBoard(kite, ids.jobM)).toEqual([]);
  });

  it("cannot move or remove another company's card", async () => {
    await expect(m.moveCard(kite, { cardId: ids.cardM, stage: "rejected", position: 1 })).rejects.toBeInstanceOf(ScopeError);
    await expect(m.removeFromPipeline(kite, ids.cardM)).rejects.toBeInstanceOf(ScopeError);
    const card = await db.query.pipelineCards.findFirst({ where: eq(pipelineCards.id, ids.cardM) });
    expect(card).toMatchObject({ stage: "interview", position: 1024 });
  });

  it("moves its own card (optimistic UI's server half)", async () => {
    const moved = await m.moveCard(kite, { cardId: ids.cardK, stage: "contacted", position: 2048 });
    expect(moved).toMatchObject({ stage: "contacted", position: 2048 });
  });

  it("cannot attach another company's job or touch its shortlists, searches, jobs or notes", async () => {
    await expect(m.addToPipeline(kite, { studentUserId: ids.asha, jobId: ids.jobM, stage: "sourced" })).rejects.toBeInstanceOf(ScopeError);
    await expect(m.addToShortlist(kite, { shortlistId: ids.shortlistM, studentUserId: ids.asha })).rejects.toBeInstanceOf(ScopeError);
    await expect(m.deleteShortlist(kite, ids.shortlistM)).rejects.toBeInstanceOf(ScopeError);
    await expect(m.deleteSavedSearch(kite, ids.savedM)).rejects.toBeInstanceOf(ScopeError);
    await expect(m.setJobStatus(kite, ids.jobM, "closed")).rejects.toBeInstanceOf(ScopeError);
    await expect(
      m.upsertJob(kite, {
        id: ids.jobM,
        title: "Hijack",
        description: "Twenty characters at least here.",
        location: "X",
        workMode: "remote",
        employmentType: "full_time",
        minProofScore: 0,
        openings: 1,
        requiredSkills: [],
        status: "open",
      }),
    ).rejects.toBeInstanceOf(ScopeError);
    expect(await q.getShortlists(kite)).toEqual([]);
    expect(await q.getSavedSearches(kite)).toEqual([]);
    expect((await q.getJobs(kite)).map((j) => j.id)).toEqual([ids.jobK]);
    const ctx = await q.getCandidateContext(kite, ids.asha);
    expect(ctx.notes).toEqual([]);
    expect((await q.getCandidateContext(monsoon, ids.asha)).notes).toHaveLength(1);
  });

  it("cannot pipeline, shortlist or invite a hidden student it has no relationship with", async () => {
    await expect(m.addToPipeline(monsoon, { studentUserId: ids.chirag, stage: "sourced" })).rejects.toBeInstanceOf(ScopeError);
    await expect(m.inviteToCheck(monsoon, { studentUserId: ids.chirag, skillCheckId: ids.check })).rejects.toBeInstanceOf(ScopeError);
    const added = await m.addToPipeline(kite, { studentUserId: ids.chirag, jobId: ids.jobK, stage: "sourced" });
    expect(added.created).toBe(true);
  });

  it("messaging: recruiters start threads only with visible students; others only reply", async () => {
    await expect(msg.assertCanMessage({ id: ids.recruiterM, role: "recruiter", companyId: ids.companyM }, ids.chirag)).rejects.toBeInstanceOf(ScopeError);
    await expect(msg.assertCanMessage({ id: ids.asha, role: "student" }, ids.recruiterK)).rejects.toBeInstanceOf(ScopeError);
    await msg.sendMessage({ id: ids.recruiterK, name: "Rita K", role: "recruiter", companyId: ids.companyK }, { recipientUserId: ids.asha, body: "Hi" });
    await expect(msg.assertCanMessage({ id: ids.asha, role: "student" }, ids.recruiterK)).resolves.toBeUndefined();
    const threads = await msg.listThreads(ids.recruiterM);
    expect(threads).toEqual([]);
  });

  it("sparse positions land strictly between neighbours", () => {
    expect(positionBetween(undefined, undefined)).toBe(1024);
    expect(positionBetween(1024, 2048)).toBe(1536);
    expect(positionBetween(undefined, 1024)).toBeLessThan(1024);
    expect(positionBetween(2048, undefined)).toBeGreaterThan(2048);
  });
});

describe("placement-officer scope", () => {
  it("cohort contains only the officer's college", async () => {
    expect((await cq.getCohortStudents(alpha)).map((s) => s.userId).sort()).toEqual([ids.asha, ids.bhavin].sort());
    expect((await cq.getCohortStudents(beta)).map((s) => s.userId).sort()).toEqual([ids.chirag, ids.diya].sort());
    const a = await cq.getCohortAnalytics(alpha);
    expect(a.total).toBe(2);
    expect(a.funnel.at(-1)?.n).toBe(1); // only Asha is 70+
  });

  it("cannot open or edit another college's drive", async () => {
    expect(await cq.getDrive(alpha, ids.driveB)).toBeNull();
    expect((await cq.getDrives(alpha)).map((d) => d.id)).toEqual([ids.driveA]);
    await expect(cm.setDriveStatus(alpha, ids.driveB, "cancelled")).rejects.toBeInstanceOf(ScopeError);
    await expect(cm.updateDriveStudent(alpha, { driveId: ids.driveB, studentUserId: ids.diya, status: "selected" })).rejects.toBeInstanceOf(ScopeError);
    await expect(cm.syncEligible(alpha, ids.driveB)).rejects.toBeInstanceOf(ScopeError);
  });

  it("eligibility never reaches outside the college", async () => {
    expect(await cq.eligibleStudentIds(alpha, { minProofScore: 70 })).toEqual([ids.asha]);
    expect(await cq.eligibleStudentIds(beta, { skills: ["react"] })).toEqual(expect.arrayContaining([ids.chirag, ids.diya]));
    expect(await cq.eligibleStudentIds(alpha, { skills: ["react"], graduationYears: [2027] })).toEqual([]);
  });

  it("nudges silently drop students from other colleges", async () => {
    const res = await cm.nudgeStudents(alpha, [ids.asha, ids.chirag, ids.diya]);
    expect(res.sent).toBe(1);
    const toDiya = await db.query.notifications.findMany({ where: eq(notifications.userId, ids.diya) });
    expect(toDiya.filter((n) => n.type === "college.nudge")).toEqual([]);
  });

  it("placement stats and CSV are per college, with formula injection neutralised", async () => {
    const a = await cq.getPlacementStats(alpha);
    expect(a.placements.map((p) => p.studentUserId)).toEqual([ids.asha]);
    const b = await cq.getPlacementStats(beta);
    expect(b.placements.map((p) => p.studentUserId)).toEqual([ids.chirag]); // offer on a Proof application
    const csv = cq.placementsCsv(a.placements);
    expect(csv.split("\r\n")[0]).toBe("Name,Handle,Branch,Graduation year,Proof Score,Company,Source,Result");
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
  });
});
