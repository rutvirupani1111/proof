import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db";
import { createTestDb, ids, seedWorld } from "./test-fixtures";

const h = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/db")>()),
  getDb: async () => h.db,
}));

const { candidatesByIds, normalizeFilters, prefixTsQuery, searchCandidates } = await import("./engine");
const { canSeeCandidate, getCandidate } = await import("@/server/recruiter/queries");

let close: () => Promise<void>;
beforeAll(async () => {
  const t = await createTestDb();
  h.db = t.db;
  close = t.close;
  await seedWorld(t.db as Db);
}, 60_000);
afterAll(async () => close?.());

const who = async (filters: unknown) => (await searchCandidates(filters)).hits.map((x) => x.userId);

describe("evidence search: privacy", () => {
  it("never returns hidden profiles, with or without filters", async () => {
    const all = await searchCandidates({});
    expect(all.hits.map((x) => x.userId)).toEqual([ids.asha, ids.bhavin, ids.diya]);
    expect(all.total).toBe(3);
    expect(await who({ skills: ["react"] })).not.toContain(ids.chirag);
    expect(await who({ q: "chirag" })).toEqual([]);
    expect(await who({ location: "Pune" })).toEqual([ids.asha]);
  });

  it("compare and dossier refuse hidden students, except to a company they applied to", async () => {
    expect(await candidatesByIds([ids.chirag, ids.asha])).toHaveLength(1);
    const kite = { userId: ids.recruiterK, companyId: ids.companyK };
    const monsoon = { userId: ids.recruiterM, companyId: ids.companyM };
    expect(await canSeeCandidate(kite, ids.chirag)).toBe(true);
    expect(await canSeeCandidate(monsoon, ids.chirag)).toBe(false);
    expect(await getCandidate(monsoon, ids.chirag)).toBeNull();
    expect((await getCandidate(kite, ids.chirag))?.user.id).toBe(ids.chirag);
  });
});

describe("evidence search: each filter is enforced by the database", () => {
  it("skill requires verified evidence in that skill (score > 0)", async () => {
    expect(await who({ skills: ["react"] })).toEqual([ids.asha, ids.diya]);
    expect(await who({ skills: ["nodejs"] })).toEqual([ids.bhavin]); // Asha claims Node.js with no evidence
    expect(await who({ skills: ["react", "nodejs"] })).toEqual([]);
    expect(await who({ skills: ["cobol"] })).toEqual([]); // unknown skill never widens results
  });

  it("minimum Proof Score", async () => {
    expect(await who({ minScore: 50 })).toEqual([ids.asha, ids.bhavin]);
  });

  it("has a live (verified) deployment; failed ones do not count", async () => {
    expect(await who({ hasDeployment: true })).toEqual([ids.asha]);
  });

  it("minimum own commits counts verified repos only", async () => {
    expect(await who({ minOwnCommits: 100 })).toEqual([ids.asha]);
    expect(await who({ minOwnCommits: 25 })).toEqual([ids.asha, ids.bhavin]);
  });

  it("passed a skill check", async () => {
    expect(await who({ passedCheck: true })).toEqual([ids.bhavin]);
  });

  it("mentor-endorsed requires a domain-verified mentor", async () => {
    expect(await who({ mentorEndorsed: true })).toEqual([ids.asha]);
  });

  it("college, graduation year and location", async () => {
    expect(await who({ collegeIds: [ids.collegeB] })).toEqual([ids.diya]);
    expect(await who({ graduationYears: [2027] })).toEqual([ids.bhavin]);
    expect(await who({ location: "mum" })).toEqual([ids.diya]);
    expect(await who({ location: "%" })).toEqual([]); // LIKE wildcards are escaped
  });

  it("full-text with prefix matching, safe against hostile input", async () => {
    expect(await who({ q: "offl" })).toEqual([ids.asha]);
    expect(await who({ q: "payments node" })).toEqual([ids.bhavin]);
    expect(await who({ q: "'); drop table users; --" })).toEqual([]);
    expect(prefixTsQuery("React & node!")).toBe("react:* & node:*");
    expect(prefixTsQuery("!!!")).toBeNull();
  });

  it("filters combine with AND", async () => {
    expect(await who({ skills: ["react"], minScore: 50, hasDeployment: true, mentorEndorsed: true })).toEqual([ids.asha]);
    expect(await who({ skills: ["react"], collegeIds: [ids.collegeA], graduationYears: [2027] })).toEqual([]);
  });

  it("sorts by skill match when a skill is filtered, and reports facts per hit", async () => {
    const res = await searchCandidates({ skills: ["react"] });
    expect(res.hits[0]).toMatchObject({ userId: ids.asha, skillMatch: 80, ownCommits: 120, liveDeployments: 1, endorsements: 1 });
    expect(res.hits[1]).toMatchObject({ userId: ids.diya, ownCommits: 0, endorsements: 0, passedChecks: 0 });
    const byCommits = await who({ sort: "commits" });
    expect(byCommits[0]).toBe(ids.asha);
  });

  it("normalizeFilters drops junk and bad types", () => {
    expect(normalizeFilters({ minScore: 500, skills: "react", evil: 1 })).toEqual({});
    expect(normalizeFilters({ skills: ["React", "react"], minScore: 0, hasDeployment: false })).toEqual({ skills: ["react"] });
  });
});
