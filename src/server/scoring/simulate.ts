/**
 * Proof Path: "what would this proof do to my score?" answered by the real engine, never by a
 * hand-written estimate. Pure and client-safe (no DB), so the dashboard can re-run it as the
 * student stacks what-ifs.
 *
 *   const sim = simulateProofScore(currentItems, [hypotheticalDeployment]);
 *   sim.delta  // points this evidence would add, after caps, diminishing returns and recency
 */
import { CAPS, computeScore, type ScoreItem, type Signal } from "./engine";

export type Simulation = {
  before: number;
  after: number;
  delta: number;
  /** Per-signal gain (after caps). Negative never happens: evidence only adds. */
  gains: Record<Signal, number>;
  after_breakdown: Record<Signal, number>;
};

const SIGNALS = Object.keys(CAPS) as Signal[];

/** Score the current evidence, then the current evidence plus `hypothetical`, and diff. */
export function simulateProofScore(current: ScoreItem[], hypothetical: ScoreItem[], now = new Date()): Simulation {
  const a = computeScore(current, now);
  // A what-if that replaces an item (e.g. "bring this site back online") reuses its id.
  const replaced = new Set(hypothetical.map((h) => h.id));
  const b = computeScore([...current.filter((i) => !replaced.has(i.id)), ...hypothetical], now);
  const gains = Object.fromEntries(SIGNALS.map((s) => [s, Math.max(0, b.breakdown[s] - a.breakdown[s])])) as Record<Signal, number>;
  const after_breakdown = Object.fromEntries(SIGNALS.map((s) => [s, b.breakdown[s]])) as Record<Signal, number>;
  return { before: a.overall, after: b.overall, delta: b.overall - a.overall, gains, after_breakdown };
}

export type PathStep = {
  id: string;
  signal: Signal | "github";
  title: string;
  description: string;
  href: string;
  cta: string;
  /** The evidence this step would add, fed to the engine as-is. */
  items: ScoreItem[];
  /** Points this step adds on its own, from simulateProofScore. */
  delta: number;
};

export type PathContext = { githubVerified: boolean };

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
};

/**
 * The next proofs that would raise the score most, each priced by the engine. Hypothetical
 * evidence is modelled conservatively on the student's own record (a repo like their median
 * repo, an advanced check at 85, a first endorsement from a new mentor), dated `now`.
 */
export function proofPath(current: ScoreItem[], ctx: PathContext, now = new Date(), limit = 5): PathStep[] {
  const skillsOf = (kind: ScoreItem["kind"]) => {
    const tagged = current.filter((i) => i.kind === kind).flatMap((i) => i.skills);
    return tagged.length ? [...new Set(tagged)].slice(0, 2) : [];
  };
  const base = (id: string, title: string, skills: string[]) => ({ id: `whatif:${id}`, title, skills, at: now });
  const repos = current.filter((i) => i.kind === "repo_authorship");
  const deps = current.filter((i) => i.kind === "deployment");
  const checks = current.filter((i) => i.kind === "skill_check");
  const atts = current.filter((i) => i.kind === "attestation");

  const ownCommits = Math.max(30, Math.round(median(repos.map((r) => (r.kind === "repo_authorship" ? r.ownCommits : 0)))));
  const typicalRepo: ScoreItem = {
    ...base("repo", "Another verified repo", skillsOf("repo_authorship")),
    kind: "repo_authorship",
    ownCommits,
    activeWeeks: Math.max(6, Math.round(median(repos.map((r) => (r.kind === "repo_authorship" ? r.activeWeeks : 0))))),
    authorshipShare: Math.max(0.8, median(repos.map((r) => (r.kind === "repo_authorship" ? r.authorshipShare : 0)))),
  };

  const steps: Omit<PathStep, "delta">[] = [];
  if (!ctx.githubVerified) {
    steps.push({
      id: "github",
      signal: "github",
      title: "Prove your GitHub, then import a repo",
      description: "A signed gist unlocks authorship; a repo you mostly wrote is the biggest single signal.",
      href: "/student/proofs?tab=github",
      cta: "Prove GitHub",
      items: [{ ...base("github", "GitHub ownership", []), kind: "github_ownership" }, typicalRepo],
    });
  } else {
    steps.push({
      id: "repo",
      signal: "authorship",
      title: repos.length ? "Import another repo you wrote" : "Import your first repo",
      description: repos.length
        ? `Modelled on your median repo: ${ownCommits} own commits over several active weeks.`
        : "30 own commits across 6 active weeks, mostly yours.",
      href: "/student/proofs?tab=repos",
      cta: "Import a repo",
      items: [typicalRepo],
    });
  }

  const down = deps.find((d) => d.kind === "deployment" && !d.healthy);
  if (down && down.kind === "deployment") {
    steps.push({
      id: "revive",
      signal: "deployments",
      title: `Bring ${down.title} back online`,
      description: "A site that is down earns 3 points; a healthy one earns 8 or more.",
      href: "/student/proofs?tab=deployments",
      cta: "Re-check site",
      items: [{ ...down, healthy: true, at: now }],
    });
  }
  steps.push({
    id: "deployment",
    signal: "deployments",
    title: deps.length ? "Verify another live site" : "Verify a live deployment",
    description: "Add a meta tag or /.well-known/proof.txt, and link it from the repo homepage for +2.",
    href: "/student/proofs?tab=deployments",
    cta: "Verify a site",
    items: [{ ...base("deployment", "A live site", skillsOf("repo_authorship")), kind: "deployment", healthy: true, homepageMatches: true }],
  });

  const hasAdvanced = checks.some((c) => c.kind === "skill_check" && c.level === "advanced" && c.score >= 70);
  steps.push({
    id: "check",
    signal: "checks",
    title: checks.length ? (hasAdvanced ? "Pass another advanced check" : "Pass an advanced skill check") : "Take your first skill check",
    description: "Timed task graded against hidden tests. Modelled at 85/100 on advanced.",
    href: "/student/checks",
    cta: "Browse checks",
    items: [{ ...base("check", "Advanced skill check", skillsOf("skill_check")), kind: "skill_check", checkId: "whatif:check", level: "advanced", score: 85 }],
  });
  steps.push({
    id: "endorsement",
    signal: "endorsements",
    title: atts.length ? "Ask a new mentor to endorse you" : "Request a mentor endorsement",
    description: "A first endorsement from a verified mentor is worth 8; repeats from the same mentor only 2.",
    href: "/student/proofs?tab=endorsements",
    cta: "Request endorsement",
    items: [{ ...base("endorsement", "Mentor endorsement", skillsOf("repo_authorship")), kind: "attestation", mentorId: "whatif:mentor", mentorDomain: "mentor.example" }],
  });

  return steps
    .map((s) => ({ ...s, delta: simulateProofScore(current, s.items, now).delta }))
    .filter((s) => s.delta > 0)
    .sort((a, b) => b.delta - a.delta || a.id.localeCompare(b.id))
    .slice(0, limit);
}

/** Serialisable form of ScoreItem for client components (dates as ISO strings). */
export type WireScoreItem = Omit<ScoreItem, "at"> & { at: string | null };
export const toWire = (items: ScoreItem[]): WireScoreItem[] => items.map((i) => ({ ...i, at: i.at ? i.at.toISOString() : null }) as WireScoreItem);
export const fromWire = (items: WireScoreItem[]): ScoreItem[] => items.map((i) => ({ ...i, at: i.at ? new Date(i.at) : null }) as ScoreItem);
