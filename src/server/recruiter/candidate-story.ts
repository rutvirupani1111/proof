/**
 * The candidate story: a plain-English summary built only from verified evidence. Every number in
 * it is a link to the dossier section that proves it, so a recruiter can check any claim in one
 * click. Opened from a job, it also lists strengths and gaps against that job's bar.
 *
 * Pure: no database, no clock (pass `now` for the "over N months" phrasing in tests).
 */

/** Anchors on the candidate page each claim links to. */
export const STORY_ANCHORS = {
  skills: "evidence-skills",
  repos: "evidence-repos",
  deployments: "evidence-deployments",
  checks: "evidence-checks",
  endorsements: "evidence-endorsements",
  score: "evidence-score",
} as const;
export type StoryAnchor = (typeof STORY_ANCHORS)[keyof typeof STORY_ANCHORS];

/** A run of text; when `href` is set it is a number (or fact) linked to its evidence. */
export type StoryPart = { text: string; href?: `#${StoryAnchor}` };
export type StoryPoint = { parts: StoryPart[]; tone: "strength" | "gap" };
export type CandidateStory = { parts: StoryPart[]; strengths: StoryPoint[]; gaps: StoryPoint[]; hasEvidence: boolean };

export type StoryInput = {
  firstName: string;
  proofScore: number;
  skills: { slug: string; name: string; score: number; evidenceCount: number }[];
  repos: {
    status: string;
    ownCommits: number | null;
    language: string | null;
    firstCommitAt: Date | string | null;
    lastCommitAt: Date | string | null;
  }[];
  deployments: { status: string }[];
  attempts: { status: string; title: string }[];
  attestations: { domain: string | null; domainVerifiedAt: Date | string | null; skillName: string | null }[];
};

export type StoryJob = {
  title: string;
  minProofScore: number;
  requiredSkills: { skillSlug: string; minScore: number; name?: string }[];
};

const link = (text: string, anchor: StoryAnchor): StoryPart => ({ text, href: `#${anchor}` });
const plain = (text: string): StoryPart => ({ text });
const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);
const fmt = (n: number) => n.toLocaleString("en-IN");

function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** Months between the first and last own commit across verified repos (at least 1). */
export function activeMonths(repos: StoryInput["repos"]): number | null {
  const times = repos
    .filter((r) => r.status === "verified")
    .flatMap((r) => [r.firstCommitAt, r.lastCommitAt])
    .filter((t): t is Date | string => t != null)
    .map((t) => new Date(t).getTime())
    .filter((t) => Number.isFinite(t));
  if (!times.length) return null;
  const span = Math.max(...times) - Math.min(...times);
  return Math.max(1, Math.round(span / (30.44 * 24 * 3600 * 1000)));
}

/** The language with the most own commits across verified repos. */
export function dominantLanguage(repos: StoryInput["repos"]): string | null {
  const by = new Map<string, number>();
  for (const r of repos) {
    if (r.status !== "verified" || !r.language) continue;
    by.set(r.language, (by.get(r.language) ?? 0) + (r.ownCommits ?? 0));
  }
  let best: string | null = null;
  let max = 0;
  for (const [lang, n] of by) if (n > max) [best, max] = [lang, n];
  return best;
}

export function buildCandidateStory(c: StoryInput, job?: StoryJob | null): CandidateStory {
  const sentences: StoryPart[][] = [];

  // Deployments.
  const live = c.deployments.filter((d) => d.status === "verified").length;
  if (live > 0) sentences.push([plain("Shipped "), link(`${live} live ${plural(live, "app")}`, STORY_ANCHORS.deployments)]);

  // Code authorship.
  const verifiedRepos = c.repos.filter((r) => r.status === "verified");
  const commits = verifiedRepos.reduce((a, r) => a + (r.ownCommits ?? 0), 0);
  if (commits > 0) {
    const months = activeMonths(c.repos);
    const lang = dominantLanguage(c.repos);
    const s: StoryPart[] = [link(`${fmt(commits)} own ${plural(commits, "commit")}`, STORY_ANCHORS.repos)];
    if (months) s.push(plain(" over "), link(`${months} ${plural(months, "month")}`, STORY_ANCHORS.repos));
    if (verifiedRepos.length > 1) s.push(plain(" across "), link(`${verifiedRepos.length} repos`, STORY_ANCHORS.repos));
    if (lang) s.push(plain(`, mostly ${lang}`));
    sentences.push(s);
  }

  // Skill checks: distinct checks taken (invites excluded), and how many were passed.
  const taken = new Map<string, boolean>();
  for (const a of c.attempts) {
    if (a.status === "invited") continue;
    taken.set(a.title, (taken.get(a.title) ?? false) || a.status === "passed");
  }
  if (taken.size > 0) {
    const passed = [...taken.values()].filter(Boolean).length;
    sentences.push([plain("passed "), link(`${passed} of ${taken.size}`, STORY_ANCHORS.checks), plain(` skill ${plural(taken.size, "check")}`)]);
  }

  // Endorsements from mentors whose work domain is verified.
  const verified = c.attestations.filter((a) => a.domainVerifiedAt && a.domain);
  if (verified.length === 1) {
    const a = verified[0]!;
    sentences.push([
      plain("endorsed by "),
      link(`a verified mentor at @${a.domain}`, STORY_ANCHORS.endorsements),
      ...(a.skillName ? [plain(` for ${a.skillName}`)] : []),
    ]);
  } else if (verified.length > 1) {
    const domains = [...new Set(verified.map((a) => `@${a.domain}`))];
    const skills = [...new Set(verified.map((a) => a.skillName).filter((s): s is string => !!s))];
    sentences.push([
      plain("endorsed by "),
      link(`${verified.length} verified mentors`, STORY_ANCHORS.endorsements),
      plain(` (${listJoin(domains.slice(0, 3))}${domains.length > 3 ? " and more" : ""})`),
      ...(skills.length ? [plain(` for ${listJoin(skills.slice(0, 3))}`)] : []),
    ]);
  }

  // Strongest skill.
  const top = [...c.skills].sort((a, b) => b.score - a.score)[0];
  if (top && top.score > 0) sentences.push([plain("strongest verified skill is "), link(`${top.name} (${top.score})`, STORY_ANCHORS.skills)]);

  const hasEvidence = sentences.length > 0;
  const parts: StoryPart[] = [];
  if (!hasEvidence) {
    parts.push(plain(`${c.firstName} has no verified evidence yet: no live app, no authored commits, no skill check and no mentor endorsement.`));
  } else {
    sentences.forEach((s, i) => {
      if (i > 0) parts.push(plain(i === sentences.length - 1 ? "; and " : "; "));
      const first = s[0]!;
      parts.push(i === 0 && !first.href ? { ...first, text: first.text.charAt(0).toUpperCase() + first.text.slice(1) } : first, ...s.slice(1));
    });
    parts.push(plain("."));
  }

  const strengths: StoryPoint[] = [];
  const gaps: StoryPoint[] = [];
  if (job) {
    const bySlug = new Map(c.skills.map((s) => [s.slug, s]));
    if (c.proofScore >= job.minProofScore) {
      strengths.push({ tone: "strength", parts: [plain("Proof Score "), link(String(c.proofScore), STORY_ANCHORS.score), plain(` clears the ${job.minProofScore}+ bar`)] });
    } else {
      gaps.push({ tone: "gap", parts: [plain("Proof Score "), link(String(c.proofScore), STORY_ANCHORS.score), plain(` is ${job.minProofScore - c.proofScore} below the ${job.minProofScore}+ bar`)] });
    }
    for (const req of job.requiredSkills) {
      const have = bySlug.get(req.skillSlug);
      const name = have?.name ?? req.name ?? req.skillSlug;
      if (!have || have.score <= 0) {
        gaps.push({ tone: "gap", parts: [plain(`No verified evidence for ${name} yet (needs ${req.minScore}+)`)] });
      } else if (have.score >= req.minScore) {
        strengths.push({
          tone: "strength",
          parts: [plain(`${name} `), link(String(have.score), STORY_ANCHORS.skills), plain(` vs ${req.minScore}+ required, from ${have.evidenceCount} ${plural(have.evidenceCount, "proof")}`)],
        });
      } else {
        gaps.push({ tone: "gap", parts: [plain(`${name} `), link(String(have.score), STORY_ANCHORS.skills), plain(`, ${req.minScore - have.score} short of the ${req.minScore}+ required`)] });
      }
    }
    if (live > 0) strengths.push({ tone: "strength", parts: [plain("Has "), link(`${live} verified live ${plural(live, "app")}`, STORY_ANCHORS.deployments), plain(" you can open today")] });
    else gaps.push({ tone: "gap", parts: [plain("No live deployment verified yet")] });
    if (verified.length === 0) gaps.push({ tone: "gap", parts: [plain("No endorsement from a verified mentor yet")] });
  }

  return { parts, strengths, gaps, hasEvidence };
}

/** The story as one plain string (for tests, aria labels and share text). */
export function storyText(parts: StoryPart[]): string {
  return parts.map((p) => p.text).join("");
}
