/**
 * GitHub verification over the public REST API (no OAuth):
 *   - ownership: a public gist named proof.md with the Proof handle + a one-time nonce
 *   - repo import + authorship analysis (own commits, share, active weeks, red flags)
 *
 * Every request is conditional (ETag) with an in-memory body cache, so repeat checks cost no
 * rate limit. `GITHUB_TOKEN` (optional) raises the limit from 60 to 5,000 requests per hour.
 */
import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { githubAccounts, repoStats, repos, studentProfiles } from "@/db/schema";
import { recordVerifiedEvidence, type RecordEvidenceResult } from "./evidence";
import {
  GIST_FILENAME,
  SEVERE_FLAGS,
  analyzeAuthorship,
  countFromLinkHeader,
  gistProves,
  gistStatement,
  isValidGithubUsername,
  skillsFromRepo,
} from "./rules";

const API = "https://api.github.com";

export class VerifyError extends Error {}

type Cached = { etag: string; body: unknown; link: string | null };
const g = globalThis as unknown as { __ghCache?: Map<string, Cached> };
const cache = (g.__ghCache ??= new Map());

type GhResponse<T> = { status: number; body: T; etag: string | null; link: string | null; fromCache: boolean };

/** GET with If-None-Match. A 304 returns the cached body (free against the rate limit). */
export async function ghGet<T>(pathOrUrl: string, opts: { etag?: string | null; raw?: boolean } = {}): Promise<GhResponse<T>> {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${API}${pathOrUrl}`;
  const cached = cache.get(url);
  const headers: Record<string, string> = {
    Accept: opts.raw ? "text/plain" : "application/vnd.github+json",
    "User-Agent": "proof-verifier",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const etag = cached?.etag ?? opts.etag;
  if (etag && cached) headers["If-None-Match"] = etag;
  if (process.env.GITHUB_TOKEN && url.startsWith(API)) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  let res: Response;
  try {
    res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000), cache: "no-store" });
  } catch {
    throw new VerifyError("GitHub did not respond. Try again in a minute.");
  }
  if (res.status === 304 && cached) {
    return { status: 200, body: cached.body as T, etag: cached.etag, link: cached.link, fromCache: true };
  }
  if (res.status === 404) throw new VerifyError("Not found on GitHub. Check the spelling and that it is public.");
  if (res.status === 403 || res.status === 429) {
    const reset = Number(res.headers.get("x-ratelimit-reset") ?? 0) * 1000;
    const mins = reset ? Math.max(1, Math.ceil((reset - Date.now()) / 60_000)) : 15;
    throw new VerifyError(`GitHub's rate limit was reached. Try again in about ${mins} minute${mins === 1 ? "" : "s"}.`);
  }
  if (res.status === 409) return { status: 409, body: [] as unknown as T, etag: null, link: null, fromCache: false }; // empty repo
  if (!res.ok) throw new VerifyError(`GitHub returned ${res.status}.`);
  const body = (opts.raw ? await res.text() : await res.json()) as T;
  const newEtag = res.headers.get("etag");
  const link = res.headers.get("link");
  if (newEtag) {
    if (cache.size > 2000) cache.clear();
    cache.set(url, { etag: newEtag, body, link });
  }
  return { status: res.status, body, etag: newEtag, link, fromCache: false };
}

/* ------------------------------------------------------------------ ownership */

async function handleFor(userId: string) {
  const db = await getDb();
  const p = await db.query.studentProfiles.findFirst({ where: eq(studentProfiles.userId, userId), columns: { handle: true } });
  if (!p) throw new VerifyError("Student profile not found.");
  return p.handle;
}

/** Starts (or restarts with a fresh nonce) the gist proof for a GitHub username. */
export async function startGithubProof(userId: string, username: string) {
  if (!isValidGithubUsername(username)) throw new VerifyError("That is not a valid GitHub username.");
  const db = await getDb();
  const handle = await handleFor(userId);
  const taken = await db.query.githubAccounts.findFirst({
    where: and(eq(githubAccounts.username, username), eq(githubAccounts.status, "verified")),
    columns: { userId: true },
  });
  if (taken && taken.userId !== userId) throw new VerifyError("Another Proof account already proved this GitHub username.");

  const nonce = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const existing = await db.query.githubAccounts.findFirst({ where: eq(githubAccounts.userId, userId) });
  if (existing?.status === "verified" && existing.username.toLowerCase() === username.toLowerCase()) {
    return { username: existing.username, nonce: existing.nonce, statement: gistStatement(handle, existing.username, existing.nonce), verified: true };
  }
  if (existing) {
    await db
      .update(githubAccounts)
      .set({ username, nonce, status: "pending", verifiedAt: null, gistId: null, gistUrl: null, etag: null })
      .where(eq(githubAccounts.id, existing.id));
  } else {
    await db.insert(githubAccounts).values({ userId, username, nonce });
  }
  return { username, nonce, statement: gistStatement(handle, username, nonce), verified: false };
}

type Gist = { id: string; html_url: string; files: Record<string, { filename: string; raw_url: string; size: number }>; owner?: { id: number; login: string; avatar_url: string } };

/** Looks for proof.md among the user's public gists and checks handle + nonce. */
export async function checkGithubProof(userId: string): Promise<{ verified: false; message: string } | ({ verified: true } & RecordEvidenceResult)> {
  const db = await getDb();
  const account = await db.query.githubAccounts.findFirst({ where: eq(githubAccounts.userId, userId) });
  if (!account) throw new VerifyError("Start by entering your GitHub username.");
  const handle = await handleFor(userId);

  const list = await ghGet<Gist[]>(`/users/${encodeURIComponent(account.username)}/gists?per_page=100`, { etag: account.etag });
  await db.update(githubAccounts).set({ etag: list.etag ?? account.etag, lastCheckedAt: new Date() }).where(eq(githubAccounts.id, account.id));

  const candidates = list.body.filter((gist) => Object.values(gist.files).some((f) => f.filename.toLowerCase() === GIST_FILENAME));
  if (!candidates.length) {
    return { verified: false, message: `No public gist with a file named ${GIST_FILENAME} on @${account.username} yet. New gists can take a minute to appear.` };
  }
  for (const gist of candidates) {
    const file = Object.values(gist.files).find((f) => f.filename.toLowerCase() === GIST_FILENAME)!;
    if (file.size > 20_000) continue;
    const content = await ghGet<string>(file.raw_url, { raw: true });
    if (!gistProves(content.body, handle, account.nonce)) continue;

    const now = new Date();
    await db
      .update(githubAccounts)
      .set({ status: "verified", verifiedAt: now, gistId: gist.id, gistUrl: gist.html_url, githubId: gist.owner?.id ?? null, avatarUrl: gist.owner?.avatar_url ?? null })
      .where(eq(githubAccounts.id, account.id));
    const result = await recordVerifiedEvidence({
      userId,
      kind: "github_ownership",
      sourceId: account.id,
      title: `Owns github.com/${account.username}`,
      summary: "Proved with a signed proof.md gist",
      skillSlugs: ["git"],
      data: { username: account.username, gistUrl: gist.html_url },
      weight: 0.5,
      notify: { title: `GitHub @${account.username} verified`, body: "You can now import repos for authorship analysis.", href: "/student/proofs?tab=repos" },
    });
    return { verified: true, ...result };
  }
  return { verified: false, message: `Found ${GIST_FILENAME}, but it does not contain your handle and the current nonce. Paste the statement exactly.` };
}

/* ------------------------------------------------------------------ repos */

type GhRepo = {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  homepage: string | null;
  fork: boolean;
  language: string | null;
  stargazers_count: number;
  created_at: string;
  pushed_at: string;
  topics?: string[];
  owner: { login: string };
  archived?: boolean;
  size: number;
};

async function provenAccount(userId: string) {
  const db = await getDb();
  const account = await db.query.githubAccounts.findFirst({ where: eq(githubAccounts.userId, userId) });
  if (!account || account.status !== "verified") throw new VerifyError("Prove your GitHub account first.");
  return account;
}

export type CandidateRepo = { fullName: string; name: string; description: string | null; language: string | null; stars: number; fork: boolean; pushedAt: string; imported: boolean };

/** Public repos of the proven account, most recently pushed first, marked if already imported. */
export async function listCandidateRepos(userId: string): Promise<CandidateRepo[]> {
  const account = await provenAccount(userId);
  const db = await getDb();
  const res = await ghGet<GhRepo[]>(`/users/${encodeURIComponent(account.username)}/repos?per_page=100&sort=pushed&type=owner`);
  const imported = new Set((await db.select({ f: repos.fullName }).from(repos).where(eq(repos.userId, userId))).map((r) => r.f.toLowerCase()));
  return res.body
    .filter((r) => !r.archived && r.size > 0)
    .map((r) => ({
      fullName: r.full_name,
      name: r.name,
      description: r.description,
      language: r.language,
      stars: r.stargazers_count,
      fork: r.fork,
      pushedAt: r.pushed_at,
      imported: imported.has(r.full_name.toLowerCase()),
    }));
}

type GhCommit = { commit: { author: { date: string } | null; committer: { date: string } | null } };

/** Imports a repo and analyses authorship. Verified repos become evidence; flagged ones do not. */
export async function importRepo(userId: string, fullName: string) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(fullName)) throw new VerifyError("Use the owner/name form, e.g. octocat/hello-world.");
  const account = await provenAccount(userId);
  const db = await getDb();
  const [repoRes, langRes, totalRes] = await Promise.all([
    ghGet<GhRepo>(`/repos/${fullName}`),
    ghGet<Record<string, number>>(`/repos/${fullName}/languages`),
    ghGet<GhCommit[]>(`/repos/${fullName}/commits?per_page=1`),
  ]);
  const r = repoRes.body;
  const author = encodeURIComponent(account.username);
  const own: GhCommit[] = [];
  let estimate = 0;
  let exact = false;
  for (let page = 1; page <= 3; page++) {
    const res = await ghGet<GhCommit[]>(`/repos/${fullName}/commits?author=${author}&per_page=100&page=${page}`);
    own.push(...res.body);
    // Beyond the 300 sampled commits, estimate from the last page number.
    if (page === 1 && res.link) estimate = (countFromLinkHeader(res.link, 1) - 1) * 100 + 50;
    if (res.body.length < 100) {
      exact = true;
      break;
    }
  }
  const ownCount = exact ? own.length : Math.max(own.length, estimate);
  const totalCommits = totalRes.status === 409 ? 0 : countFromLinkHeader(totalRes.link, totalRes.body.length);

  const stats = analyzeAuthorship({
    isFork: r.fork,
    repoCreatedAt: new Date(r.created_at),
    totalCommits,
    ownCommitCount: ownCount,
    ownCommits: own
      .filter((c) => c.commit.author?.date)
      .map((c) => ({ authoredAt: new Date(c.commit.author!.date), committedAt: new Date(c.commit.committer?.date ?? c.commit.author!.date) })),
  });
  const severe = stats.redFlags.filter((f) => SEVERE_FLAGS.includes(f));
  const verified = stats.ownCommits > 0 && severe.length === 0;

  const values = {
    userId,
    githubAccountId: account.id,
    owner: r.owner.login,
    name: r.name,
    fullName: r.full_name,
    url: r.html_url,
    description: r.description,
    homepage: r.homepage || null,
    isFork: r.fork,
    primaryLanguage: r.language,
    languages: langRes.body,
    stars: r.stargazers_count,
    ghCreatedAt: new Date(r.created_at),
    ghPushedAt: new Date(r.pushed_at),
    selected: true,
    status: (verified ? "verified" : stats.ownCommits === 0 ? "failed" : "pending") as "verified" | "failed" | "pending",
    etag: repoRes.etag,
  };
  const [row] = await db
    .insert(repos)
    .values(values)
    .onConflictDoUpdate({ target: [repos.userId, repos.fullName], set: values })
    .returning();
  const repo = row!;
  const statValues = { repoId: repo.id, ...stats, computedAt: new Date() };
  await db.insert(repoStats).values(statValues).onConflictDoUpdate({ target: repoStats.repoId, set: statValues });

  if (!verified) {
    return { repo, stats, verified: false as const, message: stats.ownCommits === 0 ? `No commits by @${account.username} in ${r.full_name}.` : `Imported, but not counted: ${severe.join(", ").replace(/_/g, " ")}.` };
  }
  const skills = skillsFromRepo({ languages: langRes.body, topics: r.topics, name: r.name, description: r.description });
  const result = await recordVerifiedEvidence({
    userId,
    kind: "repo_authorship",
    sourceId: repo.id,
    title: `${stats.ownCommits} own commits in ${r.name}`,
    summary: `${Math.round(stats.authorshipShare * 100)}% authorship over ${stats.activeWeeks} active weeks`,
    skillSlugs: skills,
    data: { repo: r.full_name, ownCommits: stats.ownCommits, totalCommits: stats.totalCommits, activeWeeks: stats.activeWeeks, language: r.language, flags: stats.redFlags },
    weight: 1 + stats.ownCommits / 100,
    occurredAt: stats.lastCommitAt,
    notify: { title: `${r.name}: authorship verified`, body: `${stats.ownCommits} own commits, ${stats.activeWeeks} active weeks`, href: "/student/proofs?tab=repos" },
  });
  return { repo, stats, verified: true as const, ...result };
}
