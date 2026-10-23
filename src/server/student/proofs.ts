/**
 * Reads for the Proofs hub and skill checks. Every function takes the SESSION user's id.
 * Hidden tests are never selected here.
 */
import "server-only";
import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import { getDb } from "@/db";
import {
  attestations,
  checkAttempts,
  credentials,
  deployments,
  evidence,
  githubAccounts,
  mentors,
  repos,
  skillChecks,
  skills,
  studentProfiles,
  users,
} from "@/db/schema";
import { publicCheckColumns } from "@/server/verify/checks";
import { gistStatement } from "@/server/verify/rules";

export async function getProofsHub(userId: string) {
  const db = await getDb();
  const [profile, gh, repoRows, depRows, endorsementRows, mentorRows, skillRows, evidenceRows] = await Promise.all([
    db.query.studentProfiles.findFirst({ where: eq(studentProfiles.userId, userId), columns: { handle: true, proofScore: true } }),
    db.query.githubAccounts.findFirst({ where: eq(githubAccounts.userId, userId) }),
    db.query.repos.findMany({ where: eq(repos.userId, userId), with: { stats: true }, orderBy: desc(repos.ghPushedAt) }),
    db.query.deployments.findMany({
      where: eq(deployments.userId, userId),
      with: { repo: { columns: { fullName: true, name: true } } },
      orderBy: desc(deployments.createdAt),
    }),
    db
      .select({
        id: attestations.id,
        status: attestations.status,
        subjectType: attestations.subjectType,
        relationship: attestations.relationship,
        statement: attestations.statement,
        requestedAt: attestations.requestedAt,
        respondedAt: attestations.respondedAt,
        skillName: skills.name,
        repoName: repos.name,
        mentorName: users.name,
        mentorTitle: mentors.title,
        mentorOrg: mentors.organization,
        mentorDomain: mentors.emailDomain,
      })
      .from(attestations)
      .innerJoin(mentors, eq(mentors.id, attestations.mentorId))
      .innerJoin(users, eq(users.id, mentors.userId))
      .leftJoin(skills, eq(skills.id, attestations.skillId))
      .leftJoin(repos, eq(repos.id, attestations.repoId))
      .where(eq(attestations.studentUserId, userId))
      .orderBy(desc(attestations.requestedAt)),
    db
      .select({ id: mentors.id, name: users.name, title: mentors.title, organization: mentors.organization, domain: mentors.emailDomain })
      .from(mentors)
      .innerJoin(users, eq(users.id, mentors.userId))
      .where(isNotNull(mentors.domainVerifiedAt))
      .orderBy(asc(users.name)),
    db.select({ id: skills.id, name: skills.name, slug: skills.slug }).from(skills).orderBy(asc(skills.name)),
    db
      .select({ id: evidence.id, kind: evidence.kind, sourceId: evidence.sourceId, status: evidence.status, credentialId: credentials.id })
      .from(evidence)
      .leftJoin(credentials, eq(credentials.evidenceId, evidence.id))
      .where(eq(evidence.userId, userId)),
  ]);

  const credFor = (kind: string, sourceId: string) =>
    evidenceRows.find((e) => e.kind === kind && e.sourceId === sourceId && e.status === "verified")?.credentialId ?? null;

  return {
    handle: profile?.handle ?? "",
    proofScore: profile?.proofScore ?? 0,
    github: gh
      ? {
          username: gh.username,
          status: gh.status,
          gistUrl: gh.gistUrl,
          avatarUrl: gh.avatarUrl,
          verifiedAt: gh.verifiedAt,
          lastCheckedAt: gh.lastCheckedAt,
          statement: gistStatement(profile?.handle ?? "", gh.username, gh.nonce),
          credentialId: credFor("github_ownership", gh.id),
        }
      : null,
    repos: repoRows.map((r) => ({
      id: r.id,
      name: r.name,
      fullName: r.fullName,
      url: r.url,
      description: r.description,
      homepage: r.homepage,
      isFork: r.isFork,
      primaryLanguage: r.primaryLanguage,
      languages: r.languages,
      stars: r.stars,
      status: r.status,
      stats: r.stats
        ? {
            ownCommits: r.stats.ownCommits,
            totalCommits: r.stats.totalCommits,
            share: r.stats.authorshipShare,
            activeWeeks: r.stats.activeWeeks,
            firstCommitAt: r.stats.firstCommitAt,
            lastCommitAt: r.stats.lastCommitAt,
            redFlags: r.stats.redFlags,
          }
        : null,
      credentialId: credFor("repo_authorship", r.id),
    })),
    deployments: depRows.map((d) => ({
      id: d.id,
      url: d.url,
      token: d.token,
      method: d.method,
      status: d.status,
      homepageMatchesRepo: d.homepageMatchesRepo,
      lastStatusCode: d.lastStatusCode,
      lastResponseMs: d.lastResponseMs,
      lastCheckedAt: d.lastCheckedAt,
      verifiedAt: d.verifiedAt,
      repo: d.repo ? { fullName: d.repo.fullName, name: d.repo.name } : null,
      credentialId: credFor("deployment", d.id),
    })),
    endorsements: endorsementRows.map((e) => ({ ...e, credentialId: credFor("attestation", e.id) })),
    mentors: mentorRows,
    skills: skillRows,
  };
}

export type ProofsHub = Awaited<ReturnType<typeof getProofsHub>>;

/** All published checks with this student's best result and attempt count. */
export async function getChecksList(userId: string) {
  const db = await getDb();
  const [checks, attempts] = await Promise.all([
    db
      .select({
        id: skillChecks.id,
        slug: skillChecks.slug,
        title: skillChecks.title,
        level: skillChecks.level,
        timeLimitSec: skillChecks.timeLimitSec,
        prompt: skillChecks.prompt,
        skillName: skills.name,
        skillSlug: skills.slug,
      })
      .from(skillChecks)
      .leftJoin(skills, eq(skills.id, skillChecks.skillId))
      .where(eq(skillChecks.isPublished, true))
      .orderBy(asc(skillChecks.title)),
    db
      .select({
        id: checkAttempts.id,
        skillCheckId: checkAttempts.skillCheckId,
        status: checkAttempts.status,
        score: checkAttempts.score,
        submittedAt: checkAttempts.submittedAt,
        timeTakenSec: checkAttempts.timeTakenSec,
        invitedBy: checkAttempts.invitedByUserId,
      })
      .from(checkAttempts)
      .where(eq(checkAttempts.userId, userId))
      .orderBy(desc(checkAttempts.createdAt)),
  ]);
  const order = { beginner: 0, intermediate: 1, advanced: 2 } as const;
  return checks
    .map((c) => {
      const mine = attempts.filter((a) => a.skillCheckId === c.id);
      const scored = mine.filter((a) => a.score != null);
      const best = scored.length ? Math.max(...scored.map((a) => a.score!)) : null;
      return {
        ...c,
        prompt: c.prompt.split(". ")[0]!.replace(/`/g, "") + ".",
        attempts: scored.length,
        best,
        passed: mine.some((a) => a.status === "passed"),
        invited: mine.some((a) => a.status === "invited"),
        inProgress: mine.some((a) => a.status === "in_progress"),
      };
    })
    .sort((a, b) => order[a.level] - order[b.level] || a.title.localeCompare(b.title));
}

export async function getCheckForRunner(userId: string, slug: string) {
  const db = await getDb();
  const check = await db.query.skillChecks.findFirst({
    where: and(eq(skillChecks.slug, slug), eq(skillChecks.isPublished, true)),
    columns: publicCheckColumns,
    with: { skill: { columns: { name: true, slug: true } } },
  });
  if (!check) return null;
  const hidden = await db.query.skillChecks.findFirst({ where: eq(skillChecks.id, check.id), columns: { hiddenTests: true } });
  const history = await db
    .select({
      id: checkAttempts.id,
      status: checkAttempts.status,
      score: checkAttempts.score,
      startedAt: checkAttempts.startedAt,
      submittedAt: checkAttempts.submittedAt,
      timeTakenSec: checkAttempts.timeTakenSec,
      pasteEvents: checkAttempts.pasteEvents,
      tabBlurs: checkAttempts.tabBlurs,
      code: checkAttempts.code,
    })
    .from(checkAttempts)
    .where(and(eq(checkAttempts.userId, userId), eq(checkAttempts.skillCheckId, check.id)))
    .orderBy(desc(checkAttempts.createdAt))
    .limit(10);
  return { check, hiddenCount: hidden?.hiddenTests.length ?? 0, history };
}
