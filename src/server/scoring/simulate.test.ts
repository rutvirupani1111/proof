import { describe, expect, it } from "vitest";
import { computeScore, type ScoreItem } from "./engine";
import { buildReplay, weekStart } from "./replay";
import { fromWire, proofPath, simulateProofScore, toWire } from "./simulate";

const now = new Date("2026-10-20T00:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

const repo = (id: string, own: number, weeks: number, at = daysAgo(5)): ScoreItem => ({
  id, title: id, kind: "repo_authorship", ownCommits: own, activeWeeks: weeks, authorshipShare: 1, skills: ["react"], at,
});
type Dep = Extract<ScoreItem, { kind: "deployment" }>;
const dep = (id: string, healthy = true): Dep => ({ id, title: id, kind: "deployment", healthy, homepageMatches: false, skills: ["react"], at: daysAgo(10) });
const att = (id: string, mentorId: string): ScoreItem => ({ id, title: id, kind: "attestation", mentorId, mentorDomain: "x.edu", skills: [], at: daysAgo(3) });

describe("simulateProofScore", () => {
  it("is the engine's own diff", () => {
    const cur = [repo("r1", 40, 8)];
    const hyp = [dep("d1")];
    const sim = simulateProofScore(cur, hyp, now);
    expect(sim.before).toBe(computeScore(cur, now).overall);
    expect(sim.after).toBe(computeScore([...cur, ...hyp], now).overall);
    expect(sim.delta).toBe(sim.after - sim.before);
    expect(sim.gains.deployments).toBe(8);
  });

  it("an empty what-if changes nothing", () => {
    const sim = simulateProofScore([repo("r1", 40, 8)], [], now);
    expect(sim.delta).toBe(0);
  });

  it("respects caps and diminishing returns instead of adding naively", () => {
    const cur = [att("a1", "m1"), att("a2", "m2")];
    const sameMentor = simulateProofScore(cur, [att("a3", "m1")], now);
    const newMentor = simulateProofScore(cur, [att("a3", "m3")], now);
    expect(sameMentor.gains.endorsements).toBe(2);
    expect(newMentor.gains.endorsements).toBe(4); // 16 + 8 capped at 20
  });

  it("a what-if with an existing id replaces that item (reviving a down site)", () => {
    const down = dep("d1", false);
    const sim = simulateProofScore([down], [{ ...down, healthy: true }], now);
    expect(sim.gains.deployments).toBe(5); // 3 -> 8
  });

  it("stacked what-ifs are not the sum of their solo deltas when a cap binds", () => {
    const cur = [att("a1", "m1")];
    const a = [att("x1", "n1")];
    const b = [att("x2", "n2")];
    const stacked = simulateProofScore(cur, [...a, ...b], now).gains.endorsements;
    const solo = simulateProofScore(cur, a, now).gains.endorsements + simulateProofScore(cur, b, now).gains.endorsements;
    expect(stacked).toBe(12);
    expect(solo).toBe(16);
  });
});

describe("proofPath", () => {
  it("prices every step with the engine and sorts by gain", () => {
    const steps = proofPath([repo("r1", 40, 8)], { githubVerified: true }, now);
    expect(steps.length).toBeGreaterThan(2);
    for (const s of steps) expect(s.delta).toBe(simulateProofScore([repo("r1", 40, 8)], s.items, now).delta);
    expect(steps.map((s) => s.delta)).toEqual([...steps.map((s) => s.delta)].sort((a, b) => b - a));
  });

  it("asks for GitHub first when it is not proven, and offers to revive a down site", () => {
    const steps = proofPath([dep("d1", false)], { githubVerified: false }, now);
    expect(steps.some((s) => s.id === "github")).toBe(true);
    expect(steps.some((s) => s.id === "revive")).toBe(true);
    expect(steps.some((s) => s.id === "repo")).toBe(false);
  });

  it("drops steps that would add nothing", () => {
    const maxed = [att("a1", "m1"), att("a2", "m2"), att("a3", "m3")];
    expect(proofPath(maxed, { githubVerified: true }, now).some((s) => s.id === "endorsement")).toBe(false);
  });

  it("round-trips through the wire format", () => {
    const items = [repo("r1", 40, 8), dep("d1")];
    expect(fromWire(toWire(items))).toEqual(items);
  });
});

describe("buildReplay", () => {
  it("is empty without evidence", () => {
    expect(buildReplay([], {}, now)).toEqual({ weeks: [], events: [], finalScore: 0 });
  });

  it("ends on exactly today's score and never jumps backwards while work accrues", () => {
    const items = [repo("r1", 120, 12, daysAgo(20)), dep("d1"), att("a1", "m1")];
    const r = buildReplay(items, { r1: { first: daysAgo(200), last: daysAgo(30) } }, now);
    expect(r.finalScore).toBe(computeScore(items, now).overall);
    expect(r.weeks.at(-1)?.start).toBe(weekStart(now).toISOString());
    expect(r.weeks[0]?.start).toBe(weekStart(daysAgo(200)).toISOString());
    const commits = r.events.filter((e) => e.kind === "commit").reduce((s, e) => s + e.count, 0);
    expect(Math.abs(commits - 120)).toBeLessThanOrEqual(12);
    expect(r.events.map((e) => e.week)).toEqual([...r.events.map((e) => e.week)].sort((a, b) => a - b));
  });

  it("caps the window at maxWeeks", () => {
    const r = buildReplay([repo("r1", 50, 10)], { r1: { first: daysAgo(1500), last: daysAgo(10) } }, now, 52);
    expect(r.weeks).toHaveLength(52);
    expect(r.events.every((e) => e.week >= 0 && e.week < 52)).toBe(true);
  });
});
