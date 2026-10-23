import { describe, expect, it } from "vitest";
import { mergeFilters, parseTalentQuery, removeChip, type TalentVocab } from "./talent-query";

const vocab: TalentVocab = {
  skills: [
    { slug: "javascript", name: "JavaScript" },
    { slug: "typescript", name: "TypeScript" },
    { slug: "python", name: "Python" },
    { slug: "go", name: "Go" },
    { slug: "react", name: "React" },
    { slug: "nextjs", name: "Next.js" },
    { slug: "nodejs", name: "Node.js" },
    { slug: "postgresql", name: "PostgreSQL" },
    { slug: "mongodb", name: "MongoDB" },
    { slug: "django", name: "Django" },
    { slug: "machine-learning", name: "Machine learning" },
    { slug: "data-structures", name: "Data structures & algorithms" },
  ],
  colleges: [
    { id: "c-spit", name: "Sardar Patel Institute of Technology, Surat", shortName: "SPIT Surat", city: "Surat" },
    { id: "c-dvce", name: "Deccan Valley College of Engineering, Hyderabad", shortName: "DVCE", city: "Hyderabad" },
  ],
};
const p = (q: string, v: TalentVocab = vocab) => parseTalentQuery(q, v);

describe("parseTalentQuery: the headline example", () => {
  it("parses every clause of the spec sentence", () => {
    const r = p("react devs in Surat with live apps, 2026 grads, score 70+");
    expect(r.filters).toEqual({
      skills: ["react"],
      location: "Surat",
      hasDeployment: true,
      graduationYears: [2026],
      minScore: 70,
    });
    expect(r.text).toBe("");
    expect(r.chips.map((c) => c.kind)).toEqual(["skill", "location", "live", "year", "score"]);
  });

  it("gives each chip the exact span it came from", () => {
    const q = "react devs in Surat with live apps, 2026 grads, score 70+";
    const r = p(q);
    const byKind = Object.fromEntries(r.chips.map((c) => [c.kind, q.slice(c.start, c.end)]));
    expect(byKind.skill).toBe("react");
    expect(byKind.location).toBe("in Surat");
    expect(byKind.live).toBe("with live apps");
    expect(byKind.year).toBe("2026 grads");
    expect(byKind.score).toBe("score 70+");
  });
});

describe("parseTalentQuery: skills and synonyms", () => {
  it.each([
    ["js", "javascript"],
    ["JavaScript", "javascript"],
    ["ts", "typescript"],
    ["TypeScript", "typescript"],
    ["node", "nodejs"],
    ["Node.js", "nodejs"],
    ["nodejs", "nodejs"],
    ["postgres", "postgresql"],
    ["psql", "postgresql"],
    ["pg", "postgresql"],
    ["mongo", "mongodb"],
    ["next.js", "nextjs"],
    ["reactjs", "react"],
    ["golang", "go"],
    ["ml", "machine-learning"],
    ["machine learning", "machine-learning"],
    ["dsa", "data-structures"],
    ["py", "python"],
  ])("%s means %s", (q, slug) => {
    expect(p(`${q} developers`).filters.skills).toEqual([slug]);
  });

  it("finds several skills, in reading order, without duplicates", () => {
    expect(p("ts + node + postgres, also TypeScript").filters.skills).toEqual(["typescript", "nodejs", "postgresql"]);
  });

  it("prefers the longest phrase (machine learning is one skill, not two words)", () => {
    const r = p("machine learning folks");
    expect(r.filters.skills).toEqual(["machine-learning"]);
    expect(r.text).toBe("");
  });

  it("does not read the verb 'go' as the Go language, but does read 'Go'", () => {
    expect(p("devs ready to go").filters.skills).toBeUndefined();
    expect(p("Go engineers").filters.skills).toEqual(["go"]);
  });

  it("does not match a skill inside another word", () => {
    expect(p("tsunami dashboards").filters.skills).toBeUndefined();
    expect(p("javascripting").filters.skills).toBeUndefined();
  });

  it("drops synonyms for skills the platform does not track when a vocabulary is given", () => {
    expect(p("docker people").filters.skills).toBeUndefined();
    expect(p("docker people", {}).filters.skills).toEqual(["docker"]);
  });

  it("labels chips with the vocabulary name", () => {
    expect(p("postgres").chips[0]).toMatchObject({ kind: "skill", label: "PostgreSQL", key: "skill:postgresql" });
  });

  it("caps skills at eight (the search schema limit)", () => {
    const r = p("js ts python react next.js node postgres mongo django ml dsa");
    expect(r.filters.skills).toHaveLength(8);
  });
});

describe("parseTalentQuery: location and colleges", () => {
  it("reads a known city with or without 'in'", () => {
    expect(p("python Pune").filters.location).toBe("Pune");
    expect(p("python devs based in Hyderabad").filters.location).toBe("Hyderabad");
  });

  it("canonicalises city aliases", () => {
    expect(p("react in bangalore").filters.location).toBe("Bengaluru");
    expect(p("from Baroda").filters.location).toBe("Vadodara");
  });

  it("reads an unknown capitalised place after 'in'", () => {
    expect(p("django devs in Bhubaneswar").filters.location).toBe("Bhubaneswar");
  });

  it("keeps the first location only", () => {
    expect(p("in Surat or Pune").filters.location).toBe("Surat");
  });

  it("matches colleges by full name, short name and acronym", () => {
    expect(p("students at SPIT").filters.collegeIds).toEqual(["c-spit"]);
    expect(p("from SPIT Surat").filters.collegeIds).toEqual(["c-spit"]);
    expect(p("Deccan Valley College of Engineering, Hyderabad grads").filters.collegeIds).toEqual(["c-dvce"]);
  });

  it("a college short name that contains a city is a college, not a location", () => {
    const r = p("react from SPIT Surat");
    expect(r.filters.collegeIds).toEqual(["c-spit"]);
    expect(r.filters.location).toBeUndefined();
  });

  it("finds several colleges", () => {
    expect(p("SPIT or DVCE").filters.collegeIds).toEqual(["c-spit", "c-dvce"]);
  });
});

describe("parseTalentQuery: graduation years", () => {
  it.each([
    ["2026 grads", [2026]],
    ["class of 2025", [2025]],
    ["batch of 2027", [2027]],
    ["graduating in 2026", [2026]],
    ["'26 grads", [2026]],
    ["2025-2027", [2025, 2026, 2027]],
    ["2025 to 2026 batch", [2025, 2026]],
    ["2025 or 2026", [2025, 2026]],
  ])("%s", (q, years) => {
    expect(p(q).filters.graduationYears).toEqual(years);
  });

  it("ignores implausible years and silly ranges", () => {
    expect(p("since 1999").filters.graduationYears).toBeUndefined();
    expect(p("2010-2030").filters.graduationYears).toBeUndefined();
  });
});

describe("parseTalentQuery: score, commits and evidence flags", () => {
  it.each([
    ["score 70+", 70],
    ["score above 80", 80],
    ["proof score >= 65", 65],
    ["min score 60", 60],
    ["70+ score", 70],
    ["scoring 90", 90],
    ["score 250", 100],
  ])("%s → min score", (q, n) => {
    expect(p(q).filters.minScore).toBe(n);
  });

  it.each([
    ["100+ commits", 100],
    ["at least 200 commits", 200],
    ["over 50 own commits", 50],
    ["commits 300+", 300],
  ])("%s → min own commits", (q, n) => {
    expect(p(q).filters.minOwnCommits).toBe(n);
  });

  it("does not read a commit count as a year or a score", () => {
    const r = p("2025 commits");
    expect(r.filters.minOwnCommits).toBe(2025);
    expect(r.filters.graduationYears).toBeUndefined();
  });

  it.each(["live apps", "a live deployment", "deployed apps", "shipped products", "in production", "live"])("%s → live deployment", (q) => {
    expect(p(q).filters.hasDeployment).toBe(true);
  });

  it.each(["endorsed", "mentor-endorsed", "endorsed by a verified mentor", "with endorsements", "vouched for"])("%s → endorsed", (q) => {
    expect(p(q).filters.mentorEndorsed).toBe(true);
  });

  it.each(["passed checks", "passed a skill check", "who passed tests", "skill checks"])("%s → passed check", (q) => {
    expect(p(q).filters.passedCheck).toBe(true);
  });
});

describe("parseTalentQuery: leftover full-text", () => {
  it("keeps unrecognised words as full-text and drops filler", () => {
    const r = p("strong react devs who built offline sync payments");
    expect(r.filters.skills).toEqual(["react"]);
    expect(r.text).toBe("built offline sync payments");
    expect(r.filters.q).toBe("built offline sync payments");
  });

  it("returns nothing for empty or whitespace input", () => {
    expect(p("")).toEqual({ filters: {}, chips: [], text: "" });
    expect(p("   ,, ")).toEqual({ filters: {}, chips: [], text: "" });
  });

  it("pure filler produces no filters", () => {
    expect(p("show me some good developers please").filters).toEqual({});
  });

  it("never throws on hostile input", () => {
    for (const q of ["((((", "\\", "score +", "$^.*", "2026-", "'", "in", "c++ c# .net", "x".repeat(1000)]) {
      expect(() => p(q)).not.toThrow();
    }
  });

  it("caps the full-text at the schema limit", () => {
    const r = p(Array.from({ length: 60 }, (_, i) => `word${i}`).join(" "));
    expect(r.text.length).toBeLessThanOrEqual(120);
  });

  it("is deterministic", () => {
    const q = "ts node postgres in Pune, 2026, score 75+, endorsed, 100+ commits";
    expect(p(q)).toEqual(p(q));
  });

  it("parses a dense recruiter query end to end", () => {
    const r = p("Senior-ish TS + node + postgres people from DVCE, class of 2025, 120+ commits, passed checks, endorsed, score above 75");
    expect(r.filters).toMatchObject({
      skills: ["typescript", "nodejs", "postgresql"],
      collegeIds: ["c-dvce"],
      graduationYears: [2025],
      minOwnCommits: 120,
      passedCheck: true,
      mentorEndorsed: true,
      minScore: 75,
    });
    expect(r.text).toBe("senior-ish");
  });
});

describe("removeChip", () => {
  it("removes the phrase behind a chip and tidies punctuation", () => {
    const q = "react devs in Surat with live apps, 2026 grads, score 70+";
    const chip = p(q).chips.find((c) => c.kind === "live")!;
    const next = removeChip(q, chip, vocab);
    expect(next).toBe("react devs in Surat, 2026 grads, score 70+");
    expect(p(next).filters.hasDeployment).toBeUndefined();
  });

  it("removes every repeat of the same skill", () => {
    const q = "react, React and reactjs";
    const next = removeChip(q, { key: "skill:react" }, vocab);
    expect(p(next).filters.skills).toBeUndefined();
  });
});

describe("mergeFilters", () => {
  it("unions lists, ORs flags and keeps the stricter threshold", () => {
    expect(
      mergeFilters(
        { skills: ["react"], minScore: 60, collegeIds: ["a"], sort: "commits", q: "payments" },
        { skills: ["react", "nodejs"], minScore: 70, hasDeployment: true, q: "offline" },
      ),
    ).toEqual({ skills: ["react", "nodejs"], minScore: 70, hasDeployment: true, collegeIds: ["a"], sort: "commits", q: "payments offline" });
  });

  it("drops empty keys", () => {
    expect(mergeFilters({}, {})).toEqual({});
  });
});
