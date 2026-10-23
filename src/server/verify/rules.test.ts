import { describe, expect, it } from "vitest";
import {
  analyzeAuthorship,
  countFromLinkHeader,
  findMetaToken,
  gistProves,
  gistStatement,
  isBlockedHostname,
  isPrivateAddress,
  isValidGithubUsername,
  normalizeDeploymentUrl,
  sameSite,
  skillsFromRepo,
  wellKnownProves,
} from "./rules";

const DAY = 86_400_000;
const d = (iso: string) => new Date(iso);

describe("gist ownership", () => {
  it("the generated statement proves itself", () => {
    expect(gistProves(gistStatement("ishita-varma", "ishita", "n0nce123"), "ishita-varma", "n0nce123")).toBe(true);
  });
  it("rejects a wrong nonce or handle", () => {
    const s = gistStatement("ishita-varma", "ishita", "n0nce123");
    expect(gistProves(s, "ishita-varma", "other")).toBe(false);
    expect(gistProves(s, "someone-else", "n0nce123")).toBe(false);
    expect(gistProves(s, "ishita", "n0nce123")).toBe(false);
  });
  it("validates GitHub usernames", () => {
    expect(isValidGithubUsername("octo-cat")).toBe(true);
    expect(isValidGithubUsername("-bad")).toBe(false);
    expect(isValidGithubUsername("a/b")).toBe(false);
  });
});

describe("authorship analysis", () => {
  const spread = Array.from({ length: 10 }, (_, i) => ({ authoredAt: new Date(Date.UTC(2026, 0, 1) + i * 9 * DAY), committedAt: new Date(Date.UTC(2026, 0, 1) + i * 9 * DAY) }));

  it("computes share, active weeks and range", () => {
    const s = analyzeAuthorship({ isFork: false, repoCreatedAt: d("2025-12-01"), totalCommits: 20, ownCommitCount: 10, ownCommits: spread });
    expect(s.authorshipShare).toBe(0.5);
    expect(s.activeWeeks).toBe(10);
    expect(s.firstCommitAt?.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(s.redFlags).toEqual([]);
  });

  it("flags all commits on one day", () => {
    const same = Array.from({ length: 6 }, (_, i) => ({ authoredAt: d(`2026-03-04T0${i}:00:00Z`), committedAt: d(`2026-03-04T0${i}:00:00Z`) }));
    expect(analyzeAuthorship({ isFork: false, repoCreatedAt: null, totalCommits: 6, ownCommitCount: 6, ownCommits: same }).redFlags).toContain("all_commits_one_day");
  });

  it("flags bulk-imported history", () => {
    const imported = spread.map((c) => ({ authoredAt: c.authoredAt, committedAt: d("2026-05-01T10:00:00Z") }));
    expect(analyzeAuthorship({ isFork: false, repoCreatedAt: null, totalCommits: 10, ownCommitCount: 10, ownCommits: imported }).redFlags).toContain("bulk_import");
  });

  it("flags a new repo with years of history", () => {
    const old = [{ authoredAt: new Date(Date.now() - 900 * DAY), committedAt: new Date(Date.now() - 900 * DAY) }];
    expect(analyzeAuthorship({ isFork: false, repoCreatedAt: new Date(Date.now() - 3 * DAY), totalCommits: 1, ownCommitCount: 1, ownCommits: old }).redFlags).toContain("backdated_history");
  });

  it("flags forks without own commits and low authorship", () => {
    expect(analyzeAuthorship({ isFork: true, repoCreatedAt: null, totalCommits: 50, ownCommitCount: 0, ownCommits: [] }).redFlags).toContain("fork_without_own_commits");
    expect(analyzeAuthorship({ isFork: false, repoCreatedAt: null, totalCommits: 100, ownCommitCount: 5, ownCommits: spread.slice(0, 5) }).redFlags).toContain("low_authorship");
  });

  it("reads totals from the Link header", () => {
    expect(countFromLinkHeader('<https://api.github.com/repositories/1/commits?per_page=1&page=2>; rel="next", <https://api.github.com/repositories/1/commits?per_page=1&page=137>; rel="last"', 1)).toBe(137);
    expect(countFromLinkHeader(null, 1)).toBe(1);
  });
});

describe("skills from a repo", () => {
  it("maps languages and keywords", () => {
    const s = skillsFromRepo({ languages: { TypeScript: 9000, CSS: 1000 }, topics: ["nextjs", "tailwindcss"], name: "tiffin-tracker", description: "A React app" });
    expect(s).toEqual(expect.arrayContaining(["typescript", "nextjs", "tailwind", "react", "git"]));
    expect(s).not.toContain("python");
  });
});

describe("deployment verification", () => {
  it("finds the meta tag in any attribute order", () => {
    expect(findMetaToken('<head><meta content="proof_abc" name="proof-verification"></head>', "proof_abc")).toBe(true);
    expect(findMetaToken("<meta name=proof-verification content=proof_abc />", "proof_abc")).toBe(true);
    expect(findMetaToken('<meta name="proof-verification" content="proof_other">', "proof_abc")).toBe(false);
    expect(findMetaToken('<meta name="description" content="proof_abc">', "proof_abc")).toBe(false);
  });
  it("reads proof.txt", () => {
    expect(wellKnownProves("proof_abc\n", "proof_abc")).toBe(true);
    expect(wellKnownProves("proof-verification=proof_abc", "proof_abc")).toBe(true);
    expect(wellKnownProves("xproof_abc", "proof_abc")).toBe(false);
  });
  it("normalises URLs and blocks internal hosts", () => {
    expect(normalizeDeploymentUrl("tiffin.example.com/app")?.href).toBe("https://tiffin.example.com/app");
    expect(normalizeDeploymentUrl("http://localhost:3000")).toBeNull();
    expect(normalizeDeploymentUrl("http://127.0.0.1")).toBeNull();
    expect(normalizeDeploymentUrl("http://169.254.169.254/latest")).toBeNull();
    expect(normalizeDeploymentUrl("ftp://x.example")).toBeNull();
    expect(normalizeDeploymentUrl("https://user:pw@x.example")).toBeNull();
    expect(isBlockedHostname("printer.local")).toBe(true);
    expect(isBlockedHostname("example.com")).toBe(false);
  });
  it("classifies private addresses", () => {
    for (const ip of ["10.0.0.1", "172.16.5.4", "192.168.1.1", "127.0.0.1", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "::ffff:10.0.0.1"]) expect(isPrivateAddress(ip)).toBe(true);
    for (const ip of ["8.8.8.8", "76.76.21.21", "2606:4700::1111"]) expect(isPrivateAddress(ip)).toBe(false);
  });
  it("matches repo homepage hosts", () => {
    expect(sameSite("https://www.tiffin.example/", "tiffin.example")).toBe(true);
    expect(sameSite("https://a.example", "https://b.example")).toBe(false);
  });
});
