import { describe, expect, it } from "vitest";
import { KIT_LIMITS, buildInterviewKit, kitText, monthLabel, stableHash, type KitInput } from "./interview-kit";

const base: KitInput = {
  firstName: "Asha",
  skills: [
    { slug: "react", name: "React", score: 81 },
    { slug: "node", name: "Node.js", score: 64 },
  ],
  evidence: [
    { kind: "repo_authorship", sourceId: "r1", skillSlugs: ["node", "react"] },
    { kind: "repo_authorship", sourceId: "r2", skillSlugs: ["node"] },
    { kind: "deployment", sourceId: "d1", skillSlugs: ["react"] },
    { kind: "skill_check", sourceId: "a1", skillSlugs: ["node"] },
  ],
  repos: [
    {
      id: "r1",
      name: "tiffin-tracker",
      description: "Order routing for home kitchens",
      language: "TypeScript",
      status: "verified",
      ownCommits: 142,
      totalCommits: 180,
      share: 0.79,
      activeWeeks: 14,
      firstCommitAt: "2025-11-04T10:00:00Z",
      lastCommitAt: "2026-03-18T10:00:00Z",
      redFlags: [],
    },
    {
      id: "r2",
      name: "upi-mock",
      description: null,
      language: "Go",
      status: "verified",
      ownCommits: 40,
      totalCommits: 40,
      share: 1,
      activeWeeks: 3,
      firstCommitAt: "2026-02-01T00:00:00Z",
      lastCommitAt: "2026-02-20T00:00:00Z",
      redFlags: ["all_commits_one_day"],
    },
    {
      id: "r3",
      name: "unverified-thing",
      description: null,
      language: "Python",
      status: "pending",
      ownCommits: 500,
      totalCommits: 500,
      share: 1,
      activeWeeks: 30,
      firstCommitAt: null,
      lastCommitAt: null,
      redFlags: [],
    },
  ],
  deployments: [
    { id: "d1", url: "https://tiffin.example", status: "verified", method: "meta", lastStatusCode: 200, lastResponseMs: 184 },
  ],
  attempts: [
    { id: "a1", title: "Rate limiter", level: "intermediate", status: "passed", score: 88, passedTests: 7, totalTests: 8, timeTakenSec: 1500 },
    { id: "a2", title: "Graph walk", level: "beginner", status: "failed", score: 20, passedTests: 1, totalTests: 8, timeTakenSec: 900 },
  ],
  attestations: [
    { id: "t1", mentorName: "Dr. Anand Mehta", organization: "SPIT Surat", statement: "Rebuilt our lab scheduler.", relationship: "professor", skillName: "React" },
  ],
};

describe("buildInterviewKit", () => {
  it("is deterministic: the same input always yields the same kit", () => {
    expect(buildInterviewKit(base)).toEqual(buildInterviewKit(structuredClone(base)));
    expect(stableHash("r1")).toBe(stableHash("r1"));
  });

  it("quotes the candidate's real repos, months and numbers", () => {
    const text = kitText(buildInterviewKit(base), "Asha Rao");
    expect(text).toContain("tiffin-tracker");
    expect(text).toContain("March 2026");
    expect(text).toContain("November 2025");
    expect(text).toContain("142 of 180 commits");
    expect(text).toContain("tiffin.example");
    expect(text).toContain("184 ms");
    expect(text).toContain("Dr. Anand Mehta (SPIT Surat)");
  });

  it("groups by the strongest verified skill each source proves, ordered by score", () => {
    const kit = buildInterviewKit(base);
    expect(kit.groups.map((g) => g.skillSlug)).toEqual(["react", "node"]);
    const react = kit.groups[0]!;
    // r1 proves node + react: it joins React, the higher-ranked skill.
    expect(react.questions.some((q) => q.id.startsWith("repo:r1"))).toBe(true);
    expect(react.questions.some((q) => q.source === "deployment")).toBe(true);
    // The endorsement has no evidence row but names React.
    expect(react.questions.some((q) => q.source === "endorsement")).toBe(true);
    const node = kit.groups[1]!;
    expect(node.questions.some((q) => q.source === "check")).toBe(true);
  });

  it("probes red-flagged repos instead of praising them, and skips unverified ones", () => {
    const kit = buildInterviewKit(base);
    const all = kit.groups.flatMap((g) => g.questions);
    const flagged = all.filter((q) => q.id.startsWith("repo:r2"));
    expect(flagged).toHaveLength(1);
    expect(flagged[0]!.prompt).toContain("single day");
    expect(all.some((q) => q.prompt.includes("unverified-thing"))).toBe(false);
  });

  it("asks about the missed hidden test and ignores failed checks", () => {
    const all = buildInterviewKit(base).groups.flatMap((g) => g.questions);
    const check = all.find((q) => q.source === "check")!;
    expect(check.prompt).toContain("one hidden test");
    expect(all.some((q) => q.prompt.includes("Graph walk"))).toBe(false);
  });

  it("links every question to its dossier anchor", () => {
    const all = buildInterviewKit(base).groups.flatMap((g) => g.questions);
    expect(new Set(all.map((q) => q.href))).toEqual(
      new Set(["#evidence-repos", "#evidence-deployments", "#evidence-checks", "#evidence-endorsements"]),
    );
  });

  it("puts sources with no skill link in General engineering, last", () => {
    const kit = buildInterviewKit({
      ...base,
      evidence: [],
      attestations: [{ ...base.attestations[0]!, skillName: null }],
    });
    expect(kit.groups.map((g) => g.skillName)).toEqual(["General engineering"]);
    expect(kit.groups[0]!.questions.length).toBeLessThanOrEqual(KIT_LIMITS.perGroup);
  });

  it("returns an empty kit when there is no verified evidence", () => {
    const kit = buildInterviewKit({ ...base, repos: [], deployments: [], attempts: [], attestations: [] });
    expect(kit).toEqual({ groups: [], total: 0, hasEvidence: false });
  });

  it("formats months in UTC", () => {
    expect(monthLabel("2026-03-31T23:30:00Z")).toBe("March 2026");
    expect(monthLabel(null)).toBeNull();
    expect(monthLabel("not a date")).toBeNull();
  });
});
