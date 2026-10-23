/**
 * Proof Score engine (pure). Evidence in, an explainable 0-100 score out. Never a black box:
 * every point is attributable to a named signal with a cap, and the explanation lists them.
 *
 *   Authorship   max 35  per verified repo: volume (log of own commits) + consistency (active
 *                        weeks), scaled by authorship share; red-flagged repos excluded
 *   Deployments  max 20  8 per live site (+2 when the repo homepage matches), 3 if currently down
 *   Skill checks max 25  best passing attempt per check: 5 / 8 / 11 by level x score
 *   Endorsements max 20  8 for the first endorsement from each verified mentor, +2 for repeats
 *   Recency      max 10  10 x 0.5^(days since newest evidence / 90)
 */
import type { ScoreBreakdown } from "@/db/schema";

export const CAPS = { authorship: 35, deployments: 20, checks: 25, endorsements: 20, recency: 10 } as const;
export type Signal = keyof typeof CAPS;
export const SIGNAL_LABEL: Record<Signal, string> = {
  authorship: "Code authorship",
  deployments: "Live deployments",
  checks: "Skill checks",
  endorsements: "Mentor endorsements",
  recency: "Recency",
};

type Base = { id: string; title: string; skills: string[]; at: Date | null };
export type ScoreItem =
  | (Base & { kind: "github_ownership" })
  | (Base & { kind: "repo_authorship"; ownCommits: number; activeWeeks: number; authorshipShare: number })
  | (Base & { kind: "deployment"; healthy: boolean; homepageMatches: boolean })
  | (Base & { kind: "skill_check"; checkId: string; level: "beginner" | "intermediate" | "advanced"; score: number })
  | (Base & { kind: "attestation"; mentorId: string; mentorDomain: string });

/** Repos left out of the score, so the drawer can say why. */
export type ExcludedRepo = { name: string; flags: string[] };

export const LEVEL_POINTS = { beginner: 5, intermediate: 8, advanced: 11 } as const;
export const PASS_MARK = 70;

export const FLAG_LABEL: Record<string, string> = {
  all_commits_one_day: "all commits landed on a single day",
  bulk_import: "history looks bulk-imported",
  backdated_history: "repo created recently but history claims years",
  fork_without_own_commits: "fork with no commits of your own",
  low_authorship: "you wrote under 20% of the commits",
};

export function repoPoints(ownCommits: number, activeWeeks: number, share: number): number {
  if (ownCommits <= 0) return 0;
  const volume = 3 * Math.log2(1 + ownCommits / 5);
  const consistency = Math.min(4, activeWeeks / 6);
  return Math.min(12, volume + consistency) * (0.5 + 0.5 * Math.max(0, Math.min(1, share)));
}

export function recencyPoints(newest: Date | null, now: Date): number {
  if (!newest) return 0;
  const days = Math.max(0, (now.getTime() - newest.getTime()) / 86_400_000);
  return CAPS.recency * 0.5 ** (days / 90);
}

type Raw = Record<Signal, number>;

function rawSignals(items: ScoreItem[], now: Date): { raw: Raw; reasons: string[] } {
  const reasons: string[] = [];
  const repos = items.filter((i) => i.kind === "repo_authorship");
  const deps = items.filter((i) => i.kind === "deployment");
  const checks = items.filter((i) => i.kind === "skill_check");
  const atts = items.filter((i) => i.kind === "attestation");

  // Authorship
  const authorship = repos.reduce((sum, r) => sum + repoPoints(r.ownCommits, r.activeWeeks, r.authorshipShare), 0);
  if (repos.length) {
    const own = repos.reduce((s, r) => s + r.ownCommits, 0);
    const weeks = repos.reduce((s, r) => s + r.activeWeeks, 0);
    const share = repos.reduce((s, r) => s + r.authorshipShare, 0) / repos.length;
    reasons.push(
      `${own} own commits across ${repos.length} verified repo${repos.length === 1 ? "" : "s"}, ${weeks} active weeks, ${Math.round(share * 100)}% average authorship`,
    );
  }

  // Deployments
  const deployments = deps.reduce((sum, d) => sum + (d.healthy ? 8 + (d.homepageMatches ? 2 : 0) : 3), 0);
  if (deps.length) {
    const live = deps.filter((d) => d.healthy).length;
    const matched = deps.filter((d) => d.homepageMatches).length;
    reasons.push(
      `${live} live deployment${live === 1 ? "" : "s"} responding${deps.length > live ? `, ${deps.length - live} currently down` : ""}${matched ? `, ${matched} linked from its repo homepage` : ""}`,
    );
  }

  // Skill checks: best passing attempt per check.
  const best = new Map<string, (typeof checks)[number]>();
  for (const c of checks) {
    if (c.score < PASS_MARK) continue;
    const prev = best.get(c.checkId);
    if (!prev || c.score > prev.score) best.set(c.checkId, c);
  }
  const passed = [...best.values()];
  const checkPts = passed.reduce((sum, c) => sum + LEVEL_POINTS[c.level] * (c.score / 100), 0);
  if (passed.length) {
    const levels = passed.map((c) => c.level);
    const adv = levels.filter((l) => l === "advanced").length;
    reasons.push(
      `${passed.length} skill check${passed.length === 1 ? "" : "s"} passed (best ${passed
        .map((c) => c.score)
        .sort((a, b) => b - a)
        .join(", ")})${adv ? `, ${adv} advanced` : ""}`,
    );
  }

  // Endorsements: diminishing returns per mentor.
  const perMentor = new Map<string, number>();
  let endorsements = 0;
  for (const a of atts) {
    const n = perMentor.get(a.mentorId) ?? 0;
    endorsements += n === 0 ? 8 : 2;
    perMentor.set(a.mentorId, n + 1);
  }
  if (atts.length) {
    const domains = [...new Set(atts.map((a) => `@${a.mentorDomain}`))];
    reasons.push(
      `${perMentor.size} verified mentor${perMentor.size === 1 ? "" : "s"} endorsed this work (${domains.join(", ")})`,
    );
  }

  // Recency: from substantive evidence only (ownership alone is not activity).
  const dated = items.filter((i) => i.kind !== "github_ownership" && i.at).map((i) => i.at!.getTime());
  const newest = dated.length ? new Date(Math.max(...dated)) : null;
  const recency = recencyPoints(newest, now);
  if (newest) {
    const days = Math.round((now.getTime() - newest.getTime()) / 86_400_000);
    reasons.push(`Newest evidence ${days <= 0 ? "today" : `${days} day${days === 1 ? "" : "s"} ago`}`);
  }

  return { raw: { authorship, deployments, checks: checkPts, endorsements, recency }, reasons };
}

function capped(raw: Raw): Record<Signal, number> {
  return {
    authorship: Math.round(Math.min(CAPS.authorship, raw.authorship)),
    deployments: Math.round(Math.min(CAPS.deployments, raw.deployments)),
    checks: Math.round(Math.min(CAPS.checks, raw.checks)),
    endorsements: Math.round(Math.min(CAPS.endorsements, raw.endorsements)),
    recency: Math.round(Math.min(CAPS.recency, raw.recency)),
  };
}

export type SkillScore = { skill: string; score: number; evidenceCount: number; breakdown: ScoreBreakdown };
export type ScoreResult = {
  overall: number;
  breakdown: ScoreBreakdown;
  perSkill: SkillScore[];
  explanation: string[];
};

function scoreOf(parts: Record<Signal, number>) {
  return Math.max(0, Math.min(100, parts.authorship + parts.deployments + parts.checks + parts.endorsements + parts.recency));
}

/** Score a set of verified evidence. `excluded` repos only add explanation lines. */
export function computeScore(items: ScoreItem[], now = new Date(), excluded: ExcludedRepo[] = []): ScoreResult {
  const { raw, reasons } = rawSignals(items, now);
  const parts = capped(raw);
  const overall = scoreOf(parts);

  const explanation: string[] = [];
  for (const key of Object.keys(CAPS) as Signal[]) {
    const rawVal = raw[key];
    const capNote = rawVal > CAPS[key] + 0.5 ? " (capped)" : "";
    explanation.push(`${SIGNAL_LABEL[key]}: +${parts[key]} of ${CAPS[key]}${capNote}`);
  }
  explanation.push(...reasons);
  if (items.some((i) => i.kind === "github_ownership")) {
    explanation.push("GitHub ownership proven by a signed gist (unlocks repo authorship; no points on its own)");
  }
  for (const r of excluded) {
    explanation.push(`Not counted: ${r.name}, ${r.flags.map((f) => FLAG_LABEL[f] ?? f).join("; ")}`);
  }

  const slugs = [...new Set(items.flatMap((i) => i.skills))].sort();
  const perSkill = slugs
    .map((skill) => {
      const subset = items.filter((i) => i.skills.includes(skill));
      const r = rawSignals(subset, now);
      const p = capped(r.raw);
      return {
        skill,
        score: scoreOf(p),
        evidenceCount: subset.filter((i) => i.kind !== "github_ownership").length,
        breakdown: { ...p, reasons: r.reasons },
      };
    })
    .filter((s) => s.evidenceCount > 0 || s.score > 0)
    .sort((a, b) => b.score - a.score || a.skill.localeCompare(b.skill));

  return { overall, breakdown: { ...parts, reasons: explanation }, perSkill, explanation };
}

export type NextProof = {
  signal: Signal | "github";
  title: string;
  description: string;
  href: string;
  /** Points this step could add, at most. */
  potential: number;
};

/** The single most valuable next proof to add, then the rest in order. */
export function nextBestProofs(
  breakdown: Pick<ScoreBreakdown, Signal>,
  ctx: { githubVerified: boolean; repoCount: number; deploymentCount: number; passedChecks: number; endorsements: number },
): NextProof[] {
  const out: NextProof[] = [];
  if (!ctx.githubVerified) {
    out.push({ signal: "github", title: "Prove your GitHub", description: "Publish a proof.md gist so your repos can count toward authorship.", href: "/student/proofs?tab=github", potential: CAPS.authorship });
  } else if (breakdown.authorship < CAPS.authorship) {
    out.push({ signal: "authorship", title: ctx.repoCount ? "Import another repo" : "Import your first repo", description: "Pick a repo you wrote most of; commits, active weeks and languages are analysed.", href: "/student/proofs?tab=repos", potential: Math.min(12, CAPS.authorship - breakdown.authorship) });
  }
  if (breakdown.deployments < CAPS.deployments) {
    out.push({ signal: "deployments", title: ctx.deploymentCount ? "Verify another live site" : "Verify a live deployment", description: "Add a meta tag or /.well-known/proof.txt to something you shipped.", href: "/student/proofs?tab=deployments", potential: Math.min(10, CAPS.deployments - breakdown.deployments) });
  }
  if (breakdown.checks < CAPS.checks) {
    out.push({ signal: "checks", title: ctx.passedChecks ? "Pass an advanced skill check" : "Take a skill check", description: "Timed coding task graded in a sandbox against hidden tests.", href: "/student/checks", potential: Math.min(11, CAPS.checks - breakdown.checks) });
  }
  if (breakdown.endorsements < CAPS.endorsements) {
    out.push({ signal: "endorsements", title: ctx.endorsements ? "Ask another mentor" : "Request a mentor endorsement", description: "A verified professor or senior vouches for a specific skill.", href: "/student/proofs?tab=endorsements", potential: Math.min(8, CAPS.endorsements - breakdown.endorsements) });
  }
  return out.sort((a, b) => b.potential - a.potential);
}
