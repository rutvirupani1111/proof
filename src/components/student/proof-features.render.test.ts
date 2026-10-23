import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProofReplay } from "@/components/profile/proof-replay";
import { ProofPath } from "@/components/student/proof-path";
import type { ScoreItem } from "@/server/scoring/engine";
import { buildReplay } from "@/server/scoring/replay";
import { toWire } from "@/server/scoring/simulate";

const now = new Date("2026-10-20T00:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
const items: ScoreItem[] = [
  { id: "g", title: "GitHub", kind: "github_ownership", skills: [], at: daysAgo(300) },
  { id: "r", title: "shop-api", kind: "repo_authorship", ownCommits: 80, activeWeeks: 10, authorshipShare: 0.9, skills: ["node"], at: daysAgo(40) },
  { id: "d", title: "shop.example", kind: "deployment", healthy: false, homepageMatches: false, skills: ["node"], at: daysAgo(30) },
];

describe("server render", () => {
  it("Proof Path renders its steps with engine-priced gains", () => {
    const html = renderToString(createElement(ProofPath, { items: toWire(items), githubVerified: true, now: now.toISOString() }));
    expect(html).toContain("What would move your score most?");
    expect(html).toContain("Bring shop.example back online");
    expect(html).toMatch(/role="switch" aria-checked="false"/);
  });

  it("Proof Replay renders the finished picture before any script runs", () => {
    const replay = buildReplay(items, { r: { first: daysAgo(150), last: daysAgo(45) } }, now);
    const html = renderToString(createElement(ProofReplay, { replay }));
    expect(html).toContain(`grew to ${replay.finalScore} over ${replay.weeks.length} weeks`);
    expect(html).toContain("Scrub through weeks");
  });
});
