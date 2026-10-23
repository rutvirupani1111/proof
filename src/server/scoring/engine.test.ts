import { describe, expect, it } from "vitest";
import { CAPS, computeScore, nextBestProofs, recencyPoints, repoPoints, type ScoreItem } from "./engine";

const now = new Date("2026-10-20T00:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

const repo = (id: string, own: number, weeks: number, share = 1, skills = ["react"], at = daysAgo(5)): ScoreItem => ({
  id, title: id, kind: "repo_authorship", ownCommits: own, activeWeeks: weeks, authorshipShare: share, skills, at,
});
const dep = (id: string, healthy = true, homepageMatches = false, skills = ["react"]): ScoreItem => ({
  id, title: id, kind: "deployment", healthy, homepageMatches, skills, at: daysAgo(10),
});
const check = (id: string, checkId: string, level: "beginner" | "intermediate" | "advanced", score: number, skills = ["javascript"]): ScoreItem => ({
  id, title: id, kind: "skill_check", checkId, level, score, skills, at: daysAgo(20),
});
const att = (id: string, mentorId: string, skills = ["react"]): ScoreItem => ({
  id, title: id, kind: "attestation", mentorId, mentorDomain: "college.example", skills, at: daysAgo(3),
});

describe("signal maths", () => {
  it("repo points grow with volume but are capped at 12 per repo", () => {
    expect(repoPoints(0, 10, 1)).toBe(0);
    expect(repoPoints(10, 2, 1)).toBeLessThan(repoPoints(100, 2, 1));
    expect(repoPoints(10_000, 200, 1)).toBe(12);
  });
  it("authorship share scales repo points", () => {
    expect(repoPoints(100, 10, 0.5)).toBeCloseTo(repoPoints(100, 10, 1) * 0.75);
  });
  it("recency halves every 90 days", () => {
    expect(recencyPoints(now, now)).toBe(10);
    expect(recencyPoints(daysAgo(90), now)).toBeCloseTo(5);
    expect(recencyPoints(null, now)).toBe(0);
  });
});

describe("computeScore", () => {
  it("is zero with no evidence and still explains itself", () => {
    const r = computeScore([], now);
    expect(r.overall).toBe(0);
    expect(r.perSkill).toEqual([]);
    expect(r.explanation[0]).toBe("Code authorship: +0 of 35");
  });

  it("caps every signal and the overall at 100", () => {
    const items: ScoreItem[] = [
      ...Array.from({ length: 6 }, (_, i) => repo(`r${i}`, 400, 40)),
      ...Array.from({ length: 5 }, (_, i) => dep(`d${i}`, true, true)),
      ...Array.from({ length: 6 }, (_, i) => check(`c${i}`, `k${i}`, "advanced", 100)),
      ...Array.from({ length: 5 }, (_, i) => att(`a${i}`, `m${i}`)),
    ];
    const r = computeScore(items, now);
    expect(r.breakdown.authorship).toBe(CAPS.authorship);
    expect(r.breakdown.deployments).toBe(CAPS.deployments);
    expect(r.breakdown.checks).toBe(CAPS.checks);
    expect(r.breakdown.endorsements).toBe(CAPS.endorsements);
    expect(r.overall).toBeLessThanOrEqual(100);
    expect(r.explanation.some((l) => l.includes("(capped)"))).toBe(true);
  });

  it("breakdown parts sum to the overall score", () => {
    const r = computeScore([repo("r", 80, 12, 0.8), dep("d"), check("c", "k", "intermediate", 90), att("a", "m")], now);
    const b = r.breakdown;
    expect(b.authorship + b.deployments + b.checks + b.endorsements + b.recency).toBe(r.overall);
  });

  it("counts only the best passing attempt per check", () => {
    const once = computeScore([check("c1", "k", "advanced", 100)], now);
    const twice = computeScore([check("c1", "k", "advanced", 100), check("c2", "k", "advanced", 80)], now);
    expect(twice.breakdown.checks).toBe(once.breakdown.checks);
    expect(computeScore([check("c", "k", "advanced", 60)], now).breakdown.checks).toBe(0);
  });

  it("gives diminishing returns for repeat endorsements by one mentor", () => {
    expect(computeScore([att("a", "m"), att("b", "m")], now).breakdown.endorsements).toBe(10);
    expect(computeScore([att("a", "m1"), att("b", "m2")], now).breakdown.endorsements).toBe(16);
  });

  it("scores a site that is down lower than one that is live", () => {
    expect(computeScore([dep("d", false)], now).breakdown.deployments).toBe(3);
    expect(computeScore([dep("d", true, true)], now).breakdown.deployments).toBe(10);
  });

  it("gives ownership no points on its own but explains it", () => {
    const r = computeScore([{ id: "g", title: "g", kind: "github_ownership", skills: ["git"], at: now }], now);
    expect(r.overall).toBe(0);
    expect(r.explanation.some((l) => l.includes("GitHub ownership"))).toBe(true);
  });

  it("scores skills from only their own evidence", () => {
    const r = computeScore([repo("r", 120, 20, 1, ["react", "typescript"]), check("c", "k", "beginner", 100, ["javascript"])], now);
    const react = r.perSkill.find((s) => s.skill === "react")!;
    const js = r.perSkill.find((s) => s.skill === "javascript")!;
    expect(react.evidenceCount).toBe(1);
    expect(react.breakdown.checks).toBe(0);
    expect(js.breakdown.authorship).toBe(0);
    expect(js.score).toBeGreaterThan(0);
  });

  it("lists excluded red-flagged repos in the explanation", () => {
    const r = computeScore([], now, [{ name: "copied-repo", flags: ["all_commits_one_day"] }]);
    expect(r.explanation.at(-1)).toContain("copied-repo");
    expect(r.explanation.at(-1)).toContain("single day");
  });
});

describe("nextBestProofs", () => {
  it("asks for GitHub first when it is not proven", () => {
    const next = nextBestProofs({ authorship: 0, deployments: 0, checks: 0, endorsements: 0, recency: 0 }, { githubVerified: false, repoCount: 0, deploymentCount: 0, passedChecks: 0, endorsements: 0 });
    expect(next[0]!.signal).toBe("github");
  });
  it("skips signals that are already maxed", () => {
    const next = nextBestProofs({ authorship: 35, deployments: 20, checks: 10, endorsements: 20, recency: 10 }, { githubVerified: true, repoCount: 4, deploymentCount: 2, passedChecks: 2, endorsements: 3 });
    expect(next.map((n) => n.signal)).toEqual(["checks"]);
  });
});
