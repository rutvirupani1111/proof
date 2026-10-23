import { describe, expect, it } from "vitest";
import { activeMonths, buildCandidateStory, dominantLanguage, storyText, type StoryInput } from "./candidate-story";

const base: StoryInput = {
  firstName: "Asha",
  proofScore: 78,
  skills: [
    { slug: "react", name: "React", score: 82, evidenceCount: 4 },
    { slug: "nodejs", name: "Node.js", score: 48, evidenceCount: 2 },
  ],
  repos: [
    { status: "verified", ownCommits: 300, language: "TypeScript", firstCommitAt: "2026-01-01", lastCommitAt: "2026-06-01" },
    { status: "verified", ownCommits: 112, language: "JavaScript", firstCommitAt: "2025-12-01", lastCommitAt: "2026-09-01" },
    { status: "pending", ownCommits: 900, language: "Python", firstCommitAt: "2020-01-01", lastCommitAt: "2026-09-01" },
  ],
  deployments: [{ status: "verified" }, { status: "verified" }, { status: "verified" }, { status: "failed" }],
  attempts: [
    { status: "passed", title: "A" },
    { status: "passed", title: "B" },
    { status: "passed", title: "C" },
    { status: "failed", title: "D" },
    { status: "failed", title: "C" },
    { status: "passed", title: "E" },
    { status: "invited", title: "F" },
  ],
  attestations: [{ domain: "spit-surat.example", domainVerifiedAt: "2026-05-01", skillName: "React" }],
};

describe("buildCandidateStory", () => {
  it("writes the evidence summary in plain English", () => {
    const s = buildCandidateStory(base);
    expect(storyText(s.parts)).toBe(
      "Shipped 3 live apps; 412 own commits over 9 months across 2 repos, mostly TypeScript; passed 4 of 5 skill checks; endorsed by a verified mentor at @spit-surat.example for React; and strongest verified skill is React (82).",
    );
    expect(s.hasEvidence).toBe(true);
  });

  it("links every number to the evidence behind it", () => {
    const linked = buildCandidateStory(base).parts.filter((p) => p.href);
    expect(linked.map((p) => [p.text, p.href])).toEqual([
      ["3 live apps", "#evidence-deployments"],
      ["412 own commits", "#evidence-repos"],
      ["9 months", "#evidence-repos"],
      ["2 repos", "#evidence-repos"],
      ["4 of 5", "#evidence-checks"],
      ["a verified mentor at @spit-surat.example", "#evidence-endorsements"],
      ["React (82)", "#evidence-skills"],
    ]);
    // No digit ever appears in unlinked text.
    for (const p of buildCandidateStory(base).parts.filter((x) => !x.href)) expect(p.text).not.toMatch(/\d/);
  });

  it("ignores unverified repos, failed deployments and unverified mentors", () => {
    const s = storyText(
      buildCandidateStory({
        ...base,
        repos: [base.repos[2]!],
        deployments: [{ status: "failed" }],
        attestations: [{ domain: "gmail.com", domainVerifiedAt: null, skillName: "React" }],
      }).parts,
    );
    expect(s).not.toMatch(/commit|live app|mentor/);
  });

  it("uses singulars correctly", () => {
    const s = storyText(
      buildCandidateStory({
        ...base,
        repos: [{ status: "verified", ownCommits: 1, language: null, firstCommitAt: "2026-01-01", lastCommitAt: "2026-01-02" }],
        deployments: [{ status: "verified" }],
        attempts: [{ status: "passed", title: "A" }],
        attestations: [],
        skills: [],
      }).parts,
    );
    expect(s).toBe("Shipped 1 live app; 1 own commit over 1 month; and passed 1 of 1 skill check.");
  });

  it("summarises several verified mentors", () => {
    const s = storyText(
      buildCandidateStory({
        ...base,
        deployments: [],
        repos: [],
        attempts: [],
        skills: [],
        attestations: [
          { domain: "a.example", domainVerifiedAt: "2026-01-01", skillName: "React" },
          { domain: "b.example", domainVerifiedAt: "2026-01-01", skillName: "Node.js" },
        ],
      }).parts,
    );
    expect(s).toBe("Endorsed by 2 verified mentors (@a.example and @b.example) for React and Node.js.");
  });

  it("says so honestly when there is no evidence", () => {
    const s = buildCandidateStory({ ...base, skills: [], repos: [], deployments: [], attempts: [], attestations: [] });
    expect(s.hasEvidence).toBe(false);
    expect(storyText(s.parts)).toMatch(/^Asha has no verified evidence yet/);
    expect(s.strengths).toEqual([]);
    expect(s.gaps).toEqual([]);
  });

  it("lists strengths and gaps against a job", () => {
    const s = buildCandidateStory(base, {
      title: "Frontend engineer",
      minProofScore: 70,
      requiredSkills: [
        { skillSlug: "react", minScore: 60 },
        { skillSlug: "nodejs", minScore: 60 },
        { skillSlug: "postgresql", minScore: 50, name: "PostgreSQL" },
      ],
    });
    expect(s.strengths.map((p) => storyText(p.parts))).toEqual([
      "Proof Score 78 clears the 70+ bar",
      "React 82 vs 60+ required, from 4 proofs",
      "Has 3 verified live apps you can open today",
    ]);
    expect(s.gaps.map((p) => storyText(p.parts))).toEqual([
      "Node.js 48, 12 short of the 60+ required",
      "No verified evidence for PostgreSQL yet (needs 50+)",
    ]);
  });

  it("flags a score below the bar and missing evidence types as gaps", () => {
    const s = buildCandidateStory({ ...base, proofScore: 40, deployments: [], attestations: [] }, { title: "x", minProofScore: 55, requiredSkills: [] });
    expect(s.gaps.map((p) => storyText(p.parts))).toEqual([
      "Proof Score 40 is 15 below the 55+ bar",
      "No live deployment verified yet",
      "No endorsement from a verified mentor yet",
    ]);
  });
});

describe("story helpers", () => {
  it("activeMonths spans verified repos only", () => {
    expect(activeMonths(base.repos)).toBe(9);
    expect(activeMonths([])).toBeNull();
  });
  it("dominantLanguage weights by own commits", () => {
    expect(dominantLanguage(base.repos)).toBe("TypeScript");
    expect(dominantLanguage([])).toBeNull();
  });
});
