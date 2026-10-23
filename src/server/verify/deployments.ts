/**
 * Live-deployment verification: the student serves a token either as
 *   <meta name="proof-verification" content="TOKEN">   on the page, or
 *   TOKEN                                               at /.well-known/proof.txt
 * We fetch it (SSRF-guarded: public hosts only, manual redirects, 8 s timeout, 512 KB cap),
 * store a screenshot-free health check, and give a bonus when the repo homepage matches.
 */
import "server-only";
import { lookup } from "node:dns/promises";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { deployments, repos } from "@/db/schema";
import { recordVerifiedEvidence, revokeEvidence } from "./evidence";
import { VerifyError } from "./github";
import {
  WELL_KNOWN_PATH,
  findMetaToken,
  isBlockedHostname,
  isPrivateAddress,
  newDeploymentToken,
  normalizeDeploymentUrl,
  sameSite,
  skillsFromRepo,
  wellKnownProves,
} from "./rules";

const MAX_BYTES = 512 * 1024;

async function assertPublicHost(url: URL) {
  if (isBlockedHostname(url.hostname)) throw new VerifyError("Only public websites can be verified.");
  try {
    const addrs = await lookup(url.hostname, { all: true });
    if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new VerifyError("Only public websites can be verified.");
  } catch (err) {
    if (err instanceof VerifyError) throw err;
    throw new VerifyError(`Could not resolve ${url.hostname}.`);
  }
}

type Fetched = { status: number; ms: number; body: string; finalUrl: URL };

/** GET with manual, re-validated redirects and a body cap. */
async function safeFetch(start: URL): Promise<Fetched> {
  let url = start;
  const t0 = Date.now();
  for (let hop = 0; hop < 4; hop++) {
    await assertPublicHost(url);
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": "ProofVerifier/1.0 (+https://proof)", Accept: "text/html,text/plain;q=0.9,*/*;q=0.5" },
        cache: "no-store",
      });
    } catch {
      throw new VerifyError(`${url.host} did not respond within 8 seconds.`);
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      const next = normalizeDeploymentUrl(new URL(res.headers.get("location")!, url).href);
      if (!next) throw new VerifyError("The site redirected somewhere we cannot follow.");
      url = next;
      continue;
    }
    const reader = res.body?.getReader();
    let received = 0;
    const chunks: Uint8Array[] = [];
    if (reader) {
      while (received < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
      }
      await reader.cancel().catch(() => {});
    }
    const body = new TextDecoder().decode(Buffer.concat(chunks.map((c) => Buffer.from(c))).subarray(0, MAX_BYTES));
    return { status: res.status, ms: Date.now() - t0, body, finalUrl: url };
  }
  throw new VerifyError("Too many redirects.");
}

export async function addDeployment(userId: string, rawUrl: string, repoId?: string | null) {
  const url = normalizeDeploymentUrl(rawUrl);
  if (!url) throw new VerifyError("Enter a public http(s) URL, e.g. https://my-app.vercel.app.");
  const db = await getDb();
  if (repoId) {
    const repo = await db.query.repos.findFirst({ where: and(eq(repos.id, repoId), eq(repos.userId, userId)), columns: { id: true } });
    if (!repo) throw new VerifyError("That repo is not on your profile.");
  }
  const existing = await db.query.deployments.findFirst({ where: and(eq(deployments.userId, userId), eq(deployments.url, url.href)) });
  if (existing) return existing;
  const [row] = await db.insert(deployments).values({ userId, url: url.href, repoId: repoId ?? null, token: newDeploymentToken() }).returning();
  return row!;
}

/** Health check only (status + response time); used for re-checks of verified sites. */
async function probe(url: URL) {
  try {
    const r = await safeFetch(url);
    return { status: r.status, ms: r.ms, body: r.body, finalUrl: r.finalUrl, error: null as string | null };
  } catch (err) {
    return { status: 0, ms: 0, body: "", finalUrl: url, error: err instanceof Error ? err.message : "Unreachable" };
  }
}

export async function verifyDeployment(userId: string, deploymentId: string) {
  const db = await getDb();
  const dep = await db.query.deployments.findFirst({
    where: and(eq(deployments.id, deploymentId), eq(deployments.userId, userId)),
    with: { repo: true },
  });
  if (!dep) throw new VerifyError("Deployment not found.");
  const url = normalizeDeploymentUrl(dep.url);
  if (!url) throw new VerifyError("Stored URL is no longer valid.");

  const page = await probe(url);
  let method: "meta" | "well_known" | null = null;
  if (page.status >= 200 && page.status < 300 && findMetaToken(page.body, dep.token)) method = "meta";
  if (!method) {
    const wk = await probe(new URL(WELL_KNOWN_PATH, url.origin));
    if (wk.status >= 200 && wk.status < 300 && wellKnownProves(wk.body, dep.token)) method = "well_known";
  }
  const now = new Date();
  const homepageMatchesRepo = sameSite(dep.repo?.homepage, dep.url);
  await db
    .update(deployments)
    .set({
      lastStatusCode: page.status || null,
      lastResponseMs: page.ms || null,
      lastCheckedAt: now,
      homepageMatchesRepo,
      ...(method ? { method, status: "verified" as const, verifiedAt: dep.verifiedAt ?? now } : dep.status === "verified" ? {} : { status: "failed" as const }),
    })
    .where(eq(deployments.id, dep.id));

  if (!method) {
    const why = page.error
      ? page.error
      : page.status && (page.status < 200 || page.status >= 300)
        ? `${url.host} answered ${page.status}.`
        : "The token was not found in a proof-verification meta tag or at /.well-known/proof.txt.";
    return { verified: false as const, message: why };
  }

  const skills = dep.repo
    ? skillsFromRepo({ languages: dep.repo.languages, name: dep.repo.name, description: dep.repo.description }).filter((s) => s !== "git")
    : [];
  const result = await recordVerifiedEvidence({
    userId,
    kind: "deployment",
    sourceId: dep.id,
    title: `Live at ${url.host}`,
    summary: `${page.status} in ${page.ms} ms via ${method === "meta" ? "meta tag" : "/.well-known/proof.txt"}${homepageMatchesRepo ? ", linked from its repo" : ""}`,
    skillSlugs: skills,
    data: { url: dep.url, status: page.status, responseMs: page.ms, method, homepageMatchesRepo, repo: dep.repo?.fullName ?? null },
    weight: 1.5,
    notify: { title: `${url.host} verified live`, body: `Responded ${page.status} in ${page.ms} ms`, href: "/student/proofs?tab=deployments" },
  });
  return { verified: true as const, method, ...result };
}

/** Re-runs the health check for a verified site; a site that is down keeps its seal but scores less. */
export async function recheckDeployment(userId: string, deploymentId: string) {
  const db = await getDb();
  const dep = await db.query.deployments.findFirst({ where: and(eq(deployments.id, deploymentId), eq(deployments.userId, userId)) });
  if (!dep) throw new VerifyError("Deployment not found.");
  if (dep.status !== "verified") return verifyDeployment(userId, deploymentId);
  const url = normalizeDeploymentUrl(dep.url);
  if (!url) throw new VerifyError("Stored URL is no longer valid.");
  const page = await probe(url);
  await db
    .update(deployments)
    .set({ lastStatusCode: page.status || null, lastResponseMs: page.ms || null, lastCheckedAt: new Date() })
    .where(eq(deployments.id, dep.id));
  const { recomputeProofScore } = await import("@/server/scoring");
  const score = await recomputeProofScore(userId);
  return { verified: true as const, healthy: page.status >= 200 && page.status < 400, status: page.status, ms: page.ms, score };
}

export async function removeDeployment(userId: string, deploymentId: string) {
  const db = await getDb();
  const dep = await db.query.deployments.findFirst({ where: and(eq(deployments.id, deploymentId), eq(deployments.userId, userId)) });
  if (!dep) throw new VerifyError("Deployment not found.");
  if (dep.status === "verified") await revokeEvidence(userId, "deployment", dep.id);
  await db.delete(deployments).where(eq(deployments.id, dep.id));
}
