import "server-only";
import { and, count, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  attestations,
  checkAttempts,
  colleges,
  credentials,
  deployments,
  evidence,
  githubAccounts,
  mentors,
  profileSkills,
  repoStats,
  repos,
  skillChecks,
  skills,
  studentProfiles,
  users,
  type EvidenceKind,
} from "@/db/schema";
import type { Role } from "@/lib/auth/roles";
import { getProofScore, type PublicScore } from "./score";

export type Viewer = { id: string; role: Role } | null;

/** A labelled fact shown on an evidence card or a constellation star ("Own commits: 41"). */
export type Fact = { label: string; value: string };

export type DossierEvidence = {
  id: string;
  kind: EvidenceKind;
  title: string;
  summary: string | null;
  skillSlugs: string[];
  verifiedAt: string | null;
  /** When the work happened (falls back to verification time). */
  at: string | null;
  credentialId: string | null;
  /** The student pinned this to the top of their dossier. */
  pinned: boolean;
  sourceUrl: string | null;
  sourceLabel: string | null;
  facts: Fact[];
};

export type DossierSkill = { slug: string; name: string; category: string; score: number; evidenceCount: number };

export type TimelineEntry = {
  id: string;
  kind: EvidenceKind | "repo_span";
  at: string;
  until?: string | null;
  title: string;
  detail: string | null;
  credentialId?: string | null;
};

export type Dossier = {
  status: "ok";
  isOwner: boolean;
  profile: {
    userId: string;
    handle: string;
    name: string;
    image: string | null;
    headline: string | null;
    about: string | null;
    location: string | null;
    degree: string | null;
    branch: string | null;
    graduationYear: number | null;
    openToWork: boolean;
    targetRoles: string[];
    visibility: "public" | "recruiters" | "hidden";
    college: { name: string; shortName: string; city: string; domainVerified: boolean } | null;
  };
  score: PublicScore;
  skills: DossierSkill[];
  evidence: DossierEvidence[];
  timeline: TimelineEntry[];
  sealCount: number;
  credentialCount: number;
};

export type DossierResult = Dossier | { status: "not_found" } | { status: "restricted" };

const PRIVILEGED: Role[] = ["recruiter", "college", "admin"];

/**
 * Visibility rules, applied before anything else is read:
 *   public     -> anyone
 *   recruiters -> signed-in recruiters, placement officers, admins, and the owner ("restricted" otherwise)
 *   hidden     -> the owner only; everyone else gets a 404 (the profile's existence is not revealed)
 */
export async function getDossier(handle: string, viewer: Viewer): Promise<DossierResult> {
  const db = await getDb();
  const profile = await db.query.studentProfiles.findFirst({
    where: eq(studentProfiles.handle, handle.toLowerCase()),
    with: {
      user: { columns: { id: true, name: true, image: true } },
      college: { columns: { name: true, shortName: true, city: true, domainVerifiedAt: true } },
    },
  });
  if (!profile) return { status: "not_found" };
  const isOwner = viewer?.id === profile.userId;
  if (!isOwner) {
    if (profile.visibility === "hidden") return { status: "not_found" };
    if (profile.visibility === "recruiters" && !(viewer && PRIVILEGED.includes(viewer.role))) {
      return { status: "restricted" };
    }
  }

  const userId = profile.userId;
  const [evRows, skillRows, score] = await Promise.all([
    db
      .select({ ev: evidence, credentialId: credentials.id, revokedAt: credentials.revokedAt })
      .from(evidence)
      .leftJoin(credentials, eq(credentials.evidenceId, evidence.id))
      .where(and(eq(evidence.userId, userId), eq(evidence.status, "verified")))
      .orderBy(desc(evidence.verifiedAt)),
    db
      .select({
        slug: skills.slug,
        name: skills.name,
        category: skills.category,
        score: profileSkills.proofScore,
        evidenceCount: profileSkills.evidenceCount,
      })
      .from(profileSkills)
      .innerJoin(skills, eq(skills.id, profileSkills.skillId))
      .where(eq(profileSkills.userId, userId))
      .orderBy(desc(profileSkills.proofScore)),
    getProofScore(userId, { score: profile.proofScore, breakdown: profile.scoreBreakdown }),
  ]);

  const idsOf = (kind: EvidenceKind) => evRows.filter((r) => r.ev.kind === kind).map((r) => r.ev.sourceId);
  const repoIds = idsOf("repo_authorship");
  const deployIds = idsOf("deployment");
  const attemptIds = idsOf("skill_check");
  const attestIds = idsOf("attestation");
  const ghIds = idsOf("github_ownership");

  const [repoRows, deployRows, attemptRows, attestRows, ghRows] = await Promise.all([
    repoIds.length
      ? db
          .select({ repo: repos, stats: repoStats })
          .from(repos)
          .leftJoin(repoStats, eq(repoStats.repoId, repos.id))
          .where(inArray(repos.id, repoIds))
      : [],
    deployIds.length ? db.select().from(deployments).where(inArray(deployments.id, deployIds)) : [],
    attemptIds.length
      ? db
          .select({ attempt: checkAttempts, check: { title: skillChecks.title, level: skillChecks.level } })
          .from(checkAttempts)
          .innerJoin(skillChecks, eq(skillChecks.id, checkAttempts.skillCheckId))
          .where(inArray(checkAttempts.id, attemptIds))
      : [],
    attestIds.length
      ? db
          .select({
            at: attestations,
            mentor: { title: mentors.title, organization: mentors.organization, domain: mentors.emailDomain, verifiedAt: mentors.domainVerifiedAt },
            mentorName: users.name,
          })
          .from(attestations)
          .innerJoin(mentors, eq(mentors.id, attestations.mentorId))
          .innerJoin(users, eq(users.id, mentors.userId))
          .where(inArray(attestations.id, attestIds))
      : [],
    ghIds.length ? db.select().from(githubAccounts).where(inArray(githubAccounts.id, ghIds)) : [],
  ]);

  const repoById = new Map(repoRows.map((r) => [r.repo.id, r]));
  const deployById = new Map(deployRows.map((d) => [d.id, d]));
  const attemptById = new Map(attemptRows.map((a) => [a.attempt.id, a]));
  const attestById = new Map(attestRows.map((a) => [a.at.id, a]));
  const ghById = new Map(ghRows.map((g) => [g.id, g]));

  const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
  const day = (d: Date | null | undefined) =>
    d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "n/a";

  const pinned = new Set(profile.pinnedEvidenceIds);
  const evidenceOut: DossierEvidence[] = evRows.map(({ ev, credentialId, revokedAt }) => {
    let sourceUrl: string | null = null;
    let sourceLabel: string | null = null;
    let at: Date | null = ev.occurredAt ?? ev.verifiedAt;
    const facts: Fact[] = [];
    switch (ev.kind) {
      case "repo_authorship": {
        const r = repoById.get(ev.sourceId);
        if (r) {
          sourceUrl = r.repo.url;
          sourceLabel = r.repo.fullName;
          if (r.stats) {
            facts.push({ label: "Own commits", value: `${r.stats.ownCommits} of ${r.stats.totalCommits}` });
            facts.push({ label: "Authorship", value: `${Math.round(r.stats.authorshipShare * 100)}%` });
            facts.push({ label: "Active weeks", value: String(r.stats.activeWeeks) });
            facts.push({ label: "Last commit", value: day(r.stats.lastCommitAt) });
            at = r.stats.lastCommitAt ?? at;
          }
          if (r.repo.primaryLanguage) facts.push({ label: "Language", value: r.repo.primaryLanguage });
        }
        break;
      }
      case "deployment": {
        const d = deployById.get(ev.sourceId);
        if (d) {
          sourceUrl = d.url;
          sourceLabel = d.url.replace(/^https?:\/\//, "");
          facts.push({ label: "Status", value: d.lastStatusCode ? `${d.lastStatusCode}${d.lastStatusCode < 400 ? " OK" : ""}` : "n/a" });
          if (d.lastResponseMs != null) facts.push({ label: "Response", value: `${d.lastResponseMs} ms` });
          facts.push({ label: "Proved by", value: d.method === "well_known" ? "/.well-known/proof.txt" : "meta tag" });
          facts.push({ label: "Last checked", value: day(d.lastCheckedAt) });
          at = d.verifiedAt ?? at;
        }
        break;
      }
      case "skill_check": {
        const a = attemptById.get(ev.sourceId);
        if (a) {
          sourceLabel = `${a.check.title} · ${a.check.level}`;
          facts.push({ label: "Score", value: `${a.attempt.score ?? 0}/100` });
          facts.push({ label: "Hidden tests", value: `${a.attempt.passedTests}/${a.attempt.totalTests}` });
          if (a.attempt.timeTakenSec != null) facts.push({ label: "Time", value: `${Math.max(1, Math.round(a.attempt.timeTakenSec / 60))} min` });
          facts.push({ label: "Graded", value: "server-side sandbox" });
          at = a.attempt.submittedAt ?? at;
        }
        break;
      }
      case "attestation": {
        const a = attestById.get(ev.sourceId);
        if (a) {
          sourceLabel = `${a.mentorName}${a.mentor.title ? `, ${a.mentor.title}` : ""}`;
          facts.push({ label: "Mentor", value: a.mentorName });
          facts.push({ label: "Organisation", value: a.mentor.organization });
          facts.push({ label: "Verified domain", value: `@${a.mentor.domain}` });
          if (a.at.relationship) facts.push({ label: "Relationship", value: a.at.relationship });
          if (a.at.statement) facts.push({ label: "Statement", value: `“${a.at.statement}”` });
          at = a.at.respondedAt ?? at;
        }
        break;
      }
      case "github_ownership": {
        const g = ghById.get(ev.sourceId);
        if (g) {
          sourceUrl = `https://github.com/${g.username}`;
          sourceLabel = `github.com/${g.username}`;
          facts.push({ label: "Method", value: "public proof.md gist + nonce" });
          if (g.gistUrl) facts.push({ label: "Gist", value: g.gistUrl.replace(/^https?:\/\//, "") });
          facts.push({ label: "Verified", value: day(g.verifiedAt) });
        }
        break;
      }
    }
    return {
      id: ev.id,
      kind: ev.kind,
      title: ev.title,
      summary: ev.summary,
      skillSlugs: ev.skillSlugs,
      verifiedAt: iso(ev.verifiedAt),
      at: iso(at),
      credentialId: credentialId && !revokedAt ? credentialId : null,
      pinned: pinned.has(ev.id),
      sourceUrl,
      sourceLabel,
      facts,
    };
  });

  // Timeline: every verified item, plus the span of work on each repo (first to last commit).
  const timeline: TimelineEntry[] = evidenceOut
    .filter((e) => e.at)
    .map((e) => ({ id: e.id, kind: e.kind, at: e.at!, title: e.title, detail: e.summary ?? e.sourceLabel, credentialId: e.credentialId }));
  for (const r of repoRows) {
    if (!r.stats?.firstCommitAt) continue;
    timeline.push({
      id: `span-${r.repo.id}`,
      kind: "repo_span",
      at: r.stats.firstCommitAt.toISOString(),
      until: iso(r.stats.lastCommitAt),
      title: `Started ${r.repo.name}`,
      detail: r.repo.description,
    });
  }
  timeline.sort((a, b) => b.at.localeCompare(a.at));

  evidenceOut.sort((a, b) => Number(b.pinned) - Number(a.pinned));

  return {
    status: "ok",
    isOwner,
    profile: {
      userId,
      handle: profile.handle,
      name: profile.user.name,
      image: profile.user.image,
      headline: profile.headline,
      about: profile.about,
      location: profile.location,
      degree: profile.degree,
      branch: profile.branch,
      graduationYear: profile.graduationYear,
      openToWork: profile.openToWork,
      targetRoles: profile.targetRoles,
      visibility: profile.visibility,
      college: profile.college
        ? {
            name: profile.college.name,
            shortName: profile.college.shortName,
            city: profile.college.city,
            domainVerified: !!profile.college.domainVerifiedAt,
          }
        : null,
    },
    score,
    // Skill scores come live from the scoring engine when it has an opinion on that skill.
    skills: skillRows
      .map((s) => {
        const live = score.perSkill[s.slug];
        return live ? { ...s, score: live.score, evidenceCount: live.evidenceCount } : s;
      })
      .filter((s) => s.score > 0 || s.evidenceCount > 0)
      .sort((a, b) => b.score - a.score),
    evidence: evidenceOut,
    timeline,
    sealCount: evidenceOut.length,
    credentialCount: evidenceOut.filter((e) => e.credentialId).length,
  };
}

/** Minimal, privacy-safe card data for the OG image: only public profiles reveal anything. */
export async function getShareCard(handle: string) {
  const db = await getDb();
  const profile = await db.query.studentProfiles.findFirst({
    where: eq(studentProfiles.handle, handle.toLowerCase()),
    columns: { userId: true, handle: true, headline: true, proofScore: true, visibility: true },
    with: { user: { columns: { name: true } }, college: { columns: { shortName: true } } },
  });
  if (!profile || profile.visibility !== "public") return null;
  const [seals, top] = await Promise.all([
    db
      .select({ n: count() })
      .from(evidence)
      .where(and(eq(evidence.userId, profile.userId), eq(evidence.status, "verified"))),
    db
      .select({ name: skills.name })
      .from(profileSkills)
      .innerJoin(skills, eq(skills.id, profileSkills.skillId))
      .where(eq(profileSkills.userId, profile.userId))
      .orderBy(desc(profileSkills.proofScore))
      .limit(4),
  ]);
  return {
    name: profile.user.name,
    handle: profile.handle,
    headline: profile.headline,
    college: profile.college?.shortName ?? null,
    score: profile.proofScore,
    seals: seals[0]?.n ?? 0,
    skills: top.map((t) => t.name),
  };
}

/* -------------------------------------------------------------------------- */
/* Landing                                                                    */
/* -------------------------------------------------------------------------- */

export type LandingStats = {
  verifiedEvidence: number;
  ownCommits: number;
  liveDeployments: number;
  checksPassed: number;
  verifiedMentors: number;
  colleges: number;
  students: number;
  credentials: number;
};

/** Aggregate counts only; nothing here identifies a student. */
export async function getLandingStats(): Promise<LandingStats> {
  const db = await getDb();
  const num = (v: unknown) => Number(v ?? 0);
  const [ev, commits, live, passed, ment, col, stu, creds] = await Promise.all([
    db.select({ n: count() }).from(evidence).where(eq(evidence.status, "verified")),
    db
      .select({ n: sql<string>`coalesce(sum(${repoStats.ownCommits}), 0)` })
      .from(repoStats)
      .innerJoin(repos, eq(repos.id, repoStats.repoId))
      .where(eq(repos.status, "verified")),
    db.select({ n: count() }).from(deployments).where(eq(deployments.status, "verified")),
    db.select({ n: count() }).from(checkAttempts).where(eq(checkAttempts.status, "passed")),
    db.select({ n: count() }).from(mentors).where(isNotNull(mentors.domainVerifiedAt)),
    db.select({ n: count() }).from(colleges),
    db.select({ n: count() }).from(studentProfiles),
    db.select({ n: count() }).from(credentials),
  ]);
  return {
    verifiedEvidence: num(ev[0]?.n),
    ownCommits: num(commits[0]?.n),
    liveDeployments: num(live[0]?.n),
    checksPassed: num(passed[0]?.n),
    verifiedMentors: num(ment[0]?.n),
    colleges: num(col[0]?.n),
    students: num(stu[0]?.n),
    credentials: num(creds[0]?.n),
  };
}

export type TickerItem = {
  id: string;
  kind: EvidenceKind;
  title: string;
  summary: string | null;
  at: string | null;
  /** "Ishita V." Public profiles only, so the handle is safe to link. */
  who: string;
  handle: string;
};

/** Latest verified evidence from PUBLIC profiles only, for the landing "evidence ticker". */
export async function getEvidenceTicker(limit = 16): Promise<TickerItem[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: evidence.id,
      kind: evidence.kind,
      title: evidence.title,
      summary: evidence.summary,
      at: evidence.verifiedAt,
      name: users.name,
      handle: studentProfiles.handle,
    })
    .from(evidence)
    .innerJoin(studentProfiles, eq(studentProfiles.userId, evidence.userId))
    .innerJoin(users, eq(users.id, evidence.userId))
    .where(and(eq(evidence.status, "verified"), eq(studentProfiles.visibility, "public")))
    .orderBy(desc(evidence.verifiedAt))
    .limit(limit);
  return rows.map((r) => {
    const [first = "", ...rest] = r.name.split(" ");
    const last = rest.at(-1);
    return {
      id: r.id,
      kind: r.kind,
      title: r.title,
      summary: r.summary,
      at: r.at ? r.at.toISOString() : null,
      who: last ? `${first} ${last[0]}.` : first,
      handle: r.handle,
    };
  });
}

/** A public, high-scoring profile to feature as the "see a real dossier" example. */
export async function getFeaturedHandle(): Promise<string | null> {
  const db = await getDb();
  const row = await db.query.studentProfiles.findFirst({
    where: eq(studentProfiles.visibility, "public"),
    orderBy: desc(studentProfiles.proofScore),
    columns: { handle: true },
  });
  return row?.handle ?? null;
}
