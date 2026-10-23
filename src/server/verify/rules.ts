/**
 * Pure verification rules (no network, no DB), unit-tested in rules.test.ts:
 * gist statements, authorship analysis + red flags, deployment token detection, SSRF guards,
 * repo-to-skill mapping.
 */

/* ------------------------------------------------------------------ GitHub gist ownership */

export const GIST_FILENAME = "proof.md";

export function gistStatement(handle: string, username: string, nonce: string): string {
  return [
    "# Proof of GitHub ownership",
    "",
    `I am **${username}** on GitHub and **@${handle}** on Proof.`,
    "",
    `proof-handle: ${handle}`,
    `proof-nonce: ${nonce}`,
  ].join("\n");
}

/** The gist proves ownership when it names the Proof handle and carries the one-time nonce. */
export function gistProves(content: string, handle: string, nonce: string): boolean {
  const text = content.replace(/\r\n/g, "\n");
  const hasNonce = new RegExp(`proof-nonce:[ \\t]*${escapeRe(nonce)}[ \\t]*$`, "m").test(text);
  const hasHandle = new RegExp(`proof-handle:[ \\t]*@?${escapeRe(handle)}[ \\t]*$`, "im").test(text);
  return hasNonce && hasHandle;
}

export function isValidGithubUsername(u: string): boolean {
  return /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(u);
}

/* ------------------------------------------------------------------ authorship */

export type CommitDates = { authoredAt: Date; committedAt: Date };

export type AuthorshipInput = {
  isFork: boolean;
  repoCreatedAt: Date | null;
  totalCommits: number;
  /** Commits authored by the proven GitHub user (a sample is fine; dates drive the flags). */
  ownCommitCount: number;
  ownCommits: CommitDates[];
};

export type AuthorshipStats = {
  totalCommits: number;
  ownCommits: number;
  authorshipShare: number;
  activeWeeks: number;
  firstCommitAt: Date | null;
  lastCommitAt: Date | null;
  redFlags: string[];
};

const DAY = 86_400_000;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const weekKey = (d: Date) => Math.floor(d.getTime() / (7 * DAY));

/** Severe flags exclude the repo from the score; soft flags are only shown. */
export const SEVERE_FLAGS = ["all_commits_one_day", "bulk_import", "backdated_history", "fork_without_own_commits"];

export function analyzeAuthorship(input: AuthorshipInput): AuthorshipStats {
  const own = input.ownCommits;
  const total = Math.max(input.totalCommits, input.ownCommitCount);
  const ownCount = input.ownCommitCount;
  const authored = own.map((c) => c.authoredAt.getTime()).sort((a, b) => a - b);
  const first = authored.length ? new Date(authored[0]!) : null;
  const last = authored.length ? new Date(authored[authored.length - 1]!) : null;
  const activeWeeks = new Set(own.map((c) => weekKey(c.authoredAt))).size;
  const flags: string[] = [];

  if (input.isFork && ownCount === 0) flags.push("fork_without_own_commits");
  if (ownCount >= 5 && new Set(own.map((c) => dayKey(c.authoredAt))).size === 1) flags.push("all_commits_one_day");

  // Author dates spread over a month+ but every commit was actually committed within one day:
  // history written elsewhere and pushed in bulk (rebased/imported).
  if (own.length >= 5 && first && last && last.getTime() - first.getTime() > 30 * DAY) {
    const committed = own.map((c) => c.committedAt.getTime());
    if (Math.max(...committed) - Math.min(...committed) < DAY) flags.push("bulk_import");
  }

  // The repo was created recently yet its history claims to go back a long way.
  if (input.repoCreatedAt && first) {
    const created = input.repoCreatedAt.getTime();
    const recentRepo = Date.now() - created < 30 * DAY;
    if (recentRepo && created - first.getTime() > 180 * DAY) flags.push("backdated_history");
  }

  const share = total > 0 ? ownCount / total : 0;
  if (ownCount > 0 && share < 0.2) flags.push("low_authorship");

  return {
    totalCommits: total,
    ownCommits: ownCount,
    authorshipShare: Number(share.toFixed(3)),
    activeWeeks,
    firstCommitAt: first,
    lastCommitAt: last,
    redFlags: flags,
  };
}

/** Total count from a `per_page=1` list response: the `rel="last"` page number, else the body length. */
export function countFromLinkHeader(link: string | null, bodyLength: number): number {
  const m = link?.match(/[?&]page=(\d+)[^>]*>;\s*rel="last"/);
  return m ? Number(m[1]) : bodyLength;
}

/* ------------------------------------------------------------------ skills from a repo */

const LANG_SKILLS: Record<string, string> = {
  JavaScript: "javascript",
  TypeScript: "typescript",
  Python: "python",
  Java: "java",
  Go: "go",
  Dockerfile: "docker",
  "Jupyter Notebook": "python",
  PLpgSQL: "postgresql",
  TSQL: "sql",
};
const KEYWORD_SKILLS: [RegExp, string][] = [
  [/\breact\b/i, "react"],
  [/\bnext(\.?js)?\b/i, "nextjs"],
  [/\bnode(\.?js)?\b/i, "nodejs"],
  [/\bexpress\b/i, "express"],
  [/\bdjango\b/i, "django"],
  [/\bfastapi\b/i, "fastapi"],
  [/\bspring(-boot)?\b/i, "spring"],
  [/\btailwind(css)?\b/i, "tailwind"],
  [/\bpostgres(ql)?\b/i, "postgresql"],
  [/\bmongo(db)?\b/i, "mongodb"],
  [/\bpandas\b/i, "pandas"],
  [/\b(machine-learning|ml|scikit|tensorflow|pytorch)\b/i, "machine-learning"],
  [/\bdocker\b/i, "docker"],
  [/\baws\b/i, "aws"],
  [/\bsql\b/i, "sql"],
];

export function skillsFromRepo(r: { languages: Record<string, number>; topics?: string[]; name: string; description?: string | null }): string[] {
  const out = new Set<string>();
  const total = Object.values(r.languages).reduce((a, b) => a + b, 0) || 1;
  for (const [lang, bytes] of Object.entries(r.languages)) {
    const slug = LANG_SKILLS[lang];
    if (slug && bytes / total >= 0.08) out.add(slug);
  }
  const text = [r.name.replace(/[-_]/g, " "), r.description ?? "", ...(r.topics ?? [])].join(" ");
  for (const [re, slug] of KEYWORD_SKILLS) if (re.test(text)) out.add(slug);
  out.add("git");
  return [...out];
}

/* ------------------------------------------------------------------ deployments */

export const META_NAME = "proof-verification";
export const WELL_KNOWN_PATH = "/.well-known/proof.txt";

export function newDeploymentToken(): string {
  return `proof_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

/** Finds <meta name="proof-verification" content="TOKEN"> in any attribute order or quoting. */
export function findMetaToken(html: string, token: string): boolean {
  const metas = html.match(/<meta\b[^>]*>/gi) ?? [];
  return metas.some((tag) => {
    const name = tag.match(/\bname\s*=\s*["']?([^"'\s>]+)/i)?.[1];
    const content = tag.match(/\bcontent\s*=\s*["']?([^"'\s>]+)/i)?.[1];
    return name?.toLowerCase() === META_NAME && content === token;
  });
}

export function wellKnownProves(body: string, token: string): boolean {
  return body.split(/\r?\n/).some((line) => line.trim() === token || line.trim() === `${META_NAME}=${token}`);
}

/** Normalises user input to an https?:// origin + path, or null when it is not a public web URL. */
export function normalizeDeploymentUrl(input: string): URL | null {
  const raw = input.trim();
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  if (isBlockedHostname(url.hostname)) return null;
  url.hash = "";
  return url;
}

export function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h.includes(".") && !h.includes(":")) return true; // single-label hosts (localhost, intranet)
  if (/(^|\.)(localhost|local|internal|intranet|home|lan|corp)$/.test(h)) return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(":")) return isPrivateAddress(h);
  return false;
}

/** Loopback, private, link-local, CGNAT, unspecified and metadata addresses (v4 + v6). */
export function isPrivateAddress(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v.includes(":")) {
    if (v === "::" || v === "::1") return true;
    if (v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb")) return true;
    if (v.startsWith("fc") || v.startsWith("fd")) return true;
    const mapped = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateAddress(mapped[1]!) : false;
  }
  const p = v.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = p as [number, number, number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

export function sameSite(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  try {
    const ha = new URL(/^https?:\/\//.test(a) ? a : `https://${a}`).hostname.replace(/^www\./, "");
    const hb = new URL(/^https?:\/\//.test(b) ? b : `https://${b}`).hostname.replace(/^www\./, "");
    return ha === hb;
  } catch {
    return false;
  }
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
