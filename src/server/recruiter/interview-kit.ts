/**
 * Interview kit: evidence-based interview questions built from a candidate's own verified work
 * (repos, live deployments, skill checks, mentor endorsements), grouped by skill. Every question
 * quotes the fact it is built on, so the interviewer can ask about real decisions instead of
 * generic trivia, and each one links to the dossier section that proves it.
 *
 * Pure and deterministic: no database, no clock, no randomness. Phrasing varies per source by a
 * stable hash of its id, so the same candidate always gets the same kit (tests rely on it).
 */
import "server-only";
import { STORY_ANCHORS, type StoryAnchor } from "./candidate-story";

type When = Date | string | null;

export type KitInput = {
  firstName: string;
  skills: { slug: string; name: string; score: number }[];
  /** Verified evidence rows; `(kind, sourceId)` ties a repo/deployment/check/endorsement to skills. */
  evidence: { kind: string; sourceId: string; skillSlugs: string[] | null }[];
  repos: {
    id: string;
    name: string;
    description: string | null;
    language: string | null;
    status: string;
    ownCommits: number | null;
    totalCommits: number | null;
    share: number | null;
    activeWeeks: number | null;
    firstCommitAt: When;
    lastCommitAt: When;
    redFlags: string[] | null;
  }[];
  deployments: {
    id: string;
    url: string;
    status: string;
    method: string | null;
    lastStatusCode: number | null;
    lastResponseMs: number | null;
  }[];
  attempts: {
    id: string;
    title: string;
    level: string;
    status: string;
    score: number | null;
    passedTests: number | null;
    totalTests: number | null;
    timeTakenSec: number | null;
  }[];
  attestations: {
    id: string;
    mentorName: string;
    organization: string | null;
    statement: string | null;
    relationship: string | null;
    skillName: string | null;
  }[];
};

export type KitSource = "repo" | "deployment" | "check" | "endorsement";

export type KitQuestion = {
  /** Stable id: `<source>:<sourceId>:<n>`. */
  id: string;
  source: KitSource;
  /** What to ask, in the interviewer's voice. */
  prompt: string;
  /** The verified fact the question rests on. */
  basis: string;
  /** What a strong answer covers. */
  listenFor: string[];
  href: `#${StoryAnchor}`;
};

export type KitGroup = { skillSlug: string | null; skillName: string; score: number | null; questions: KitQuestion[] };
export type InterviewKit = { groups: KitGroup[]; total: number; hasEvidence: boolean };

export const KIT_LIMITS = { repos: 3, questionsPerRepo: 2, deployments: 2, checks: 3, endorsements: 3, perGroup: 4 } as const;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

const FLAG_PROBE: Record<string, string> = {
  all_commits_one_day: "every commit landed on a single day",
  bulk_import: "the history looks bulk-imported",
  backdated_history: "the repo is newer than its commits",
};

/** FNV-1a: a tiny stable hash so phrasing choices are deterministic per source id. */
export function stableHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** "March 2026" in UTC, so the server's timezone never changes the kit. */
export function monthLabel(when: When): string | null {
  if (when == null) return null;
  const d = new Date(when);
  if (!Number.isFinite(d.getTime())) return null;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function host(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function clip(text: string, max = 110): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

const fmt = (n: number) => n.toLocaleString("en-IN");

function pick<T>(options: readonly T[], seed: string, offset = 0): T {
  return options[(stableHash(seed) + offset) % options.length]!;
}

/* --------------------------------------------------------------- per source */

function repoQuestions(r: KitInput["repos"][number]): Omit<KitQuestion, "id">[] {
  const href = `#${STORY_ANCHORS.repos}` as const;
  const flags = (r.redFlags ?? []).map((f) => FLAG_PROBE[f]).filter((f): f is string => !!f);
  if (flags.length) {
    return [
      {
        source: "repo",
        prompt: `In ${r.name}, ${flags[0]}. Walk me through how this project was actually built, and where the earlier history lives.`,
        basis: `Authorship check flagged ${r.name}: ${flags.join("; ")}.`,
        listenFor: ["A plausible origin (moved from another repo, squashed, coursework)", "Can open the code and explain it live"],
        href,
      },
    ];
  }
  if (r.status !== "verified") return [];

  const own = r.ownCommits ?? 0;
  const total = r.totalCommits ?? own;
  const pct = r.share != null ? Math.round(r.share * 100) : null;
  const first = monthLabel(r.firstCommitAt);
  const last = monthLabel(r.lastCommitAt);
  const out: Omit<KitQuestion, "id">[] = [];

  if (last) {
    const lead = pick(
      [
        `In ${r.name}, your latest commits landed in ${last}. What were you changing then, and why?`,
        `Your most recent work on ${r.name} is from ${last}. Walk me through that change and the decision behind it.`,
        `In ${r.name}, what did your ${last} commits rework, and what would you do differently now?`,
      ],
      r.id,
    );
    out.push({
      source: "repo",
      prompt: lead,
      basis: `${fmt(own)} of ${fmt(total)} commits are theirs${last ? `, last in ${last}` : ""}.`,
      listenFor: ["Names the specific module or file", "States a trade-off they weighed", "Says what they would change"],
      href,
    });
  }

  if (first && last && first !== last) {
    out.push({
      source: "repo",
      prompt: `${r.name} runs from ${first} to ${last}${r.activeWeeks ? ` across ${r.activeWeeks} active weeks` : ""}. How did the design change between the first commit and the last?`,
      basis: `Commit history spans ${first} to ${last}.`,
      listenFor: ["An early decision they later reversed", "What forced the change (bug, scale, feedback)"],
      href,
    });
  } else if (pct != null && pct < 70 && total > own) {
    out.push({
      source: "repo",
      prompt: `You wrote ${pct}% of ${r.name}. Who else committed, how did you split the work, and how did you review each other's code?`,
      basis: `Authorship share ${pct}% (${fmt(own)} of ${fmt(total)} commits).`,
      listenFor: ["Clear ownership boundaries", "A concrete review or merge-conflict story"],
      href,
    });
  } else if (r.language) {
    out.push({
      source: "repo",
      prompt: r.description
        ? `${r.name} is described as "${clip(r.description, 80)}". Why ${r.language} for it, and what would break first under 10x the load?`
        : `Why ${r.language} for ${r.name}? What would break first under 10x the load?`,
      basis: `Primary language ${r.language}.`,
      listenFor: ["A reason tied to the problem, not habit", "Knows the bottleneck in their own code"],
      href,
    });
  }
  return out;
}

function deploymentQuestion(d: KitInput["deployments"][number]): Omit<KitQuestion, "id"> | null {
  const href = `#${STORY_ANCHORS.deployments}` as const;
  const h = host(d.url);
  if (d.status === "verified") {
    const speed = d.lastResponseMs != null ? ` and answered in ${fmt(d.lastResponseMs)} ms at the last health check` : "";
    return {
      source: "deployment",
      prompt: `${h} is live${speed}. How is it deployed, and what happens when a bad release goes out?`,
      basis: `Ownership proven via ${d.method === "well_known" ? "/.well-known/proof.txt" : "a verification meta tag"} on ${h}.`,
      listenFor: ["Build and hosting steps they set up", "Rollback or monitoring, even a simple one"],
      href,
    };
  }
  if (d.lastStatusCode != null) {
    return {
      source: "deployment",
      prompt: `${h} returned HTTP ${d.lastStatusCode} at its last health check. What would you check first to bring it back?`,
      basis: `Deployment health check failed with ${d.lastStatusCode}.`,
      listenFor: ["A debugging order (logs, DNS, build)", "Owns the outage instead of deflecting"],
      href,
    };
  }
  return null;
}

function checkQuestion(a: KitInput["attempts"][number]): Omit<KitQuestion, "id"> | null {
  if (a.status !== "passed") return null;
  const href = `#${STORY_ANCHORS.checks}` as const;
  const tests = a.passedTests != null && a.totalTests ? `${a.passedTests}/${a.totalTests} hidden tests` : null;
  const mins = a.timeTakenSec ? Math.max(1, Math.round(a.timeTakenSec / 60)) : null;
  const missed = a.passedTests != null && a.totalTests ? a.totalTests - a.passedTests : 0;
  const prompt =
    missed > 0
      ? `In "${a.title}" ${missed === 1 ? "one hidden test" : `${missed} hidden tests`} failed. Which edge case do you think you missed, and how would you find it?`
      : `You passed "${a.title}" (${a.level})${mins ? ` in ${mins} min` : ""}. Re-solve the trickiest part out loud: what was the edge case?`;
  return {
    source: "check",
    prompt,
    basis: [`Passed "${a.title}" (${a.level})`, tests, a.score != null ? `score ${a.score}` : null].filter(Boolean).join(", ") + ".",
    listenFor: ["Explains the approach before the code", "Names complexity and a failing input"],
    href,
  };
}

function endorsementQuestion(e: KitInput["attestations"][number]): Omit<KitQuestion, "id"> {
  const href = `#${STORY_ANCHORS.endorsements}` as const;
  const who = e.organization ? `${e.mentorName} (${e.organization})` : e.mentorName;
  const what = e.skillName ? `your ${e.skillName} work` : "your work";
  return {
    source: "endorsement",
    prompt: e.statement
      ? `${who} endorsed ${what}: "${clip(e.statement)}" Tell me about the moment they are describing.`
      : `${who} endorsed ${what}. What did you build or fix that they saw first-hand?`,
    basis: `Verified mentor endorsement${e.relationship ? ` (${e.relationship.replace(/_/g, " ")})` : ""}.`,
    listenFor: ["A specific situation, not a summary", "What they did versus what the team did"],
    href,
  };
}

/* ------------------------------------------------------------------ build */

/**
 * Builds the kit. A source joins the highest-scoring verified skill it is evidence for
 * (`evidence.skill_slugs`); endorsements fall back to their skill name; anything else lands in
 * "General engineering". Groups are ordered by skill score, General last.
 */
export function buildInterviewKit(input: KitInput): InterviewKit {
  const rank = new Map(input.skills.map((s, i) => [s.slug, { ...s, i }]));
  const byName = new Map(input.skills.map((s) => [s.name.toLowerCase(), s.slug]));
  const evidenceSkills = new Map<string, string[]>();
  for (const e of input.evidence) evidenceSkills.set(`${e.kind}:${e.sourceId}`, e.skillSlugs ?? []);

  const groupFor = (kind: string, sourceId: string, fallbackName?: string | null): string | null => {
    const slugs = (evidenceSkills.get(`${kind}:${sourceId}`) ?? []).filter((s) => rank.has(s));
    if (slugs.length) return slugs.sort((a, b) => rank.get(a)!.i - rank.get(b)!.i)[0]!;
    if (fallbackName) return byName.get(fallbackName.toLowerCase()) ?? null;
    return null;
  };

  const buckets = new Map<string | null, KitQuestion[]>();
  const add = (slug: string | null, source: KitSource, sourceId: string, qs: Omit<KitQuestion, "id">[]) => {
    const list = buckets.get(slug) ?? [];
    qs.forEach((q, n) => list.push({ ...q, id: `${source}:${sourceId}:${n}` }));
    buckets.set(slug, list);
  };

  const repos = [...input.repos]
    .filter((r) => r.status === "verified" || (r.redFlags ?? []).length > 0)
    .sort((a, b) => (b.ownCommits ?? 0) - (a.ownCommits ?? 0) || a.id.localeCompare(b.id))
    .slice(0, KIT_LIMITS.repos);
  for (const r of repos) add(groupFor("repo_authorship", r.id), "repo", r.id, repoQuestions(r).slice(0, KIT_LIMITS.questionsPerRepo));

  for (const d of input.deployments.slice(0, KIT_LIMITS.deployments)) {
    const q = deploymentQuestion(d);
    if (q) add(groupFor("deployment", d.id), "deployment", d.id, [q]);
  }
  for (const a of input.attempts.filter((x) => x.status === "passed").slice(0, KIT_LIMITS.checks)) {
    const q = checkQuestion(a);
    if (q) add(groupFor("skill_check", a.id), "check", a.id, [q]);
  }
  for (const e of input.attestations.slice(0, KIT_LIMITS.endorsements)) {
    add(groupFor("attestation", e.id, e.skillName), "endorsement", e.id, [endorsementQuestion(e)]);
  }

  const groups: KitGroup[] = [...buckets.entries()]
    .map(([slug, questions]) => {
      const skill = slug ? rank.get(slug) : undefined;
      return {
        skillSlug: slug,
        skillName: skill?.name ?? "General engineering",
        score: skill?.score ?? null,
        questions: questions.slice(0, KIT_LIMITS.perGroup),
      };
    })
    .sort((a, b) => {
      if (a.skillSlug === null) return 1;
      if (b.skillSlug === null) return -1;
      return rank.get(a.skillSlug)!.i - rank.get(b.skillSlug)!.i;
    });

  const total = groups.reduce((n, g) => n + g.questions.length, 0);
  return { groups, total, hasEvidence: total > 0 };
}

/** Plain text of the whole kit (copy to clipboard / paste into an ATS). */
export function kitText(kit: InterviewKit, candidateName: string): string {
  const lines = [`Interview kit: ${candidateName}`, ""];
  for (const g of kit.groups) {
    lines.push(`${g.skillName}${g.score != null ? ` (verified ${g.score})` : ""}`);
    g.questions.forEach((q, i) => {
      lines.push(`  ${i + 1}. ${q.prompt}`);
      lines.push(`     Evidence: ${q.basis}`);
      lines.push(`     Listen for: ${q.listenFor.join("; ")}`);
    });
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

/** Maps the dossier from `getCandidate` onto the kit input (structural, so no DB types leak in). */
export function kitInputFrom(c: {
  user: { name: string };
  skills: KitInput["skills"];
  evidence: KitInput["evidence"];
  repos: KitInput["repos"];
  deployments: KitInput["deployments"];
  attempts: KitInput["attempts"];
  attestations: KitInput["attestations"];
}): KitInput {
  return {
    firstName: c.user.name.split(" ")[0] || c.user.name,
    skills: c.skills,
    evidence: c.evidence,
    repos: c.repos,
    deployments: c.deployments,
    attempts: c.attempts,
    attestations: c.attestations,
  };
}
