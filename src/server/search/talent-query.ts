/**
 * Plain-English talent search. A deterministic parser (no model, no network) that turns
 * "react devs in Surat with live apps, 2026 grads, score 70+" into the evidence-search filters.
 *
 * Every recognised phrase becomes a chip with the exact character span it came from, so the UI
 * can show what was understood and remove a chip by deleting its words. Whatever is left after
 * filler words are dropped stays as full-text (`q`), so nothing the recruiter typed is ignored.
 *
 * Pure and client-safe: used by the search page, the ⌘K palette and the server render alike.
 */
import type { SearchFiltersInput } from "@/lib/validation/recruiter";

export type TalentVocab = {
  skills?: readonly { slug: string; name: string }[];
  colleges?: readonly { id: string; name: string; shortName: string; city?: string | null }[];
};

export type TalentChipKind = "skill" | "location" | "year" | "score" | "live" | "endorsed" | "check" | "commits" | "college";

export type TalentChip = {
  kind: TalentChipKind;
  /** Stable React key, e.g. `skill:react`. */
  key: string;
  label: string;
  /** Character span in the original text. */
  start: number;
  end: number;
};

export type ParsedTalentQuery = {
  filters: SearchFiltersInput;
  chips: TalentChip[];
  /** Words kept as full-text search (also in `filters.q`). */
  text: string;
};

/* -------------------------------------------------------------------------- */
/* Vocabulary                                                                  */
/* -------------------------------------------------------------------------- */

/** Canonical skill slug → aliases a recruiter might type (lower case). */
export const SKILL_SYNONYMS: Record<string, { name: string; aliases: string[] }> = {
  javascript: { name: "JavaScript", aliases: ["javascript", "js", "ecmascript", "es6", "vanilla js"] },
  typescript: { name: "TypeScript", aliases: ["typescript", "ts"] },
  python: { name: "Python", aliases: ["python", "python3", "py"] },
  java: { name: "Java", aliases: ["java"] },
  go: { name: "Go", aliases: ["golang"] },
  sql: { name: "SQL", aliases: ["sql"] },
  react: { name: "React", aliases: ["react", "reactjs", "react.js"] },
  nextjs: { name: "Next.js", aliases: ["nextjs", "next.js", "next js"] },
  nodejs: { name: "Node.js", aliases: ["node", "nodejs", "node.js", "node js"] },
  express: { name: "Express", aliases: ["express", "expressjs", "express.js"] },
  django: { name: "Django", aliases: ["django"] },
  fastapi: { name: "FastAPI", aliases: ["fastapi", "fast api"] },
  spring: { name: "Spring Boot", aliases: ["spring boot", "springboot", "spring"] },
  tailwind: { name: "Tailwind CSS", aliases: ["tailwind", "tailwindcss", "tailwind css"] },
  postgresql: { name: "PostgreSQL", aliases: ["postgresql", "postgres", "psql", "pg"] },
  mongodb: { name: "MongoDB", aliases: ["mongodb", "mongo"] },
  pandas: { name: "pandas", aliases: ["pandas"] },
  "machine-learning": { name: "Machine learning", aliases: ["machine learning", "ml"] },
  "data-structures": { name: "Data structures & algorithms", aliases: ["data structures", "dsa", "algorithms", "data structures & algorithms"] },
  docker: { name: "Docker", aliases: ["docker"] },
  aws: { name: "AWS", aliases: ["aws", "amazon web services"] },
  git: { name: "Git", aliases: ["git"] },
};

/** Skill names that are also everyday English words: only matched when typed capitalised. */
const CASE_SENSITIVE_NAMES = new Set(["go", "r", "c", "swift", "dart", "rust"]);

/** Cities matched even without "in": distinctive enough not to collide with English. */
export const KNOWN_CITIES = [
  "Surat", "Ahmedabad", "Vadodara", "Baroda", "Rajkot", "Gandhinagar", "Mumbai", "Pune", "Nagpur", "Nashik",
  "Bengaluru", "Bangalore", "Hyderabad", "Chennai", "Delhi", "New Delhi", "Noida", "Gurugram", "Gurgaon",
  "Kolkata", "Jaipur", "Indore", "Bhopal", "Kochi", "Coimbatore", "Lucknow", "Chandigarh", "Mysuru", "Mysore",
];
const CITY_ALIASES: Record<string, string> = { bangalore: "Bengaluru", baroda: "Vadodara", gurgaon: "Gurugram", mysore: "Mysuru" };

const STOPWORDS = new Set(
  (
    "a an the and or with without who whose that which have has having had is are be been can could should would " +
    "in at from of for to on by near around based located looking look find show me us get give some any all only " +
    "good great strong solid top best experienced skilled junior senior fresher freshers fresh graduate graduates grad grads " +
    "student students candidate candidates people folks profile profiles dev devs developer developers engineer engineers " +
    "programmer programmers coder coders intern interns knows know knowing using use uses plus also want need needs " +
    "please hire hiring someone anyone apps app projects project experience proof verified evidence min minimum least " +
    "over above more than at-least year years who's i we"
  ).split(" "),
);

/* -------------------------------------------------------------------------- */
/* Matching helpers                                                            */
/* -------------------------------------------------------------------------- */

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Word-bounded pattern where "word" means [a-z0-9]; tolerates "." and spaces inside the phrase. */
const phrase = (p: string, flags = "gi") => new RegExp(`(?<![a-z0-9])${esc(p).replace(/\\ /g, "\\s+").replace(/ /g, "\\s+")}(?![a-z0-9+#])`, flags);

type Ctx = { src: string; mask: boolean[]; chips: TalentChip[] };

function free(ctx: Ctx, start: number, end: number) {
  for (let i = start; i < end; i++) if (ctx.mask[i]) return false;
  return true;
}
function take(ctx: Ctx, chip: TalentChip) {
  for (let i = chip.start; i < chip.end; i++) ctx.mask[i] = true;
  ctx.chips.push(chip);
}
/** Run a global regex over the original text, calling `on` for each match whose span is unclaimed. */
function scan(ctx: Ctx, re: RegExp, on: (m: RegExpExecArray, start: number, end: number) => void) {
  re.lastIndex = 0;
  for (let m = re.exec(ctx.src); m; m = re.exec(ctx.src)) {
    const start = m.index;
    const end = start + m[0].length;
    if (m[0].length === 0) {
      re.lastIndex++;
      continue;
    }
    if (free(ctx, start, end)) on(m, start, end);
  }
}

const clampScore = (n: number) => Math.max(0, Math.min(100, n));
const toYear = (raw: string) => {
  const n = Number(raw);
  return raw.length === 2 ? 2000 + n : n;
};
const plausibleYear = (y: number) => y >= 2015 && y <= 2035;
const titleCase = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

/* -------------------------------------------------------------------------- */
/* Parser                                                                      */
/* -------------------------------------------------------------------------- */

export function parseTalentQuery(input: string, vocab: TalentVocab = {}): ParsedTalentQuery {
  const src = (input ?? "").slice(0, 300);
  const ctx: Ctx = { src, mask: new Array(src.length).fill(false), chips: [] };
  const filters: SearchFiltersInput = {};

  // 1. Own commits: "100+ commits", "at least 200 commits", "commits over 50".
  const commit = (n: number, s: number, e: number) => {
    if (!Number.isFinite(n) || n <= 0) return;
    filters.minOwnCommits = Math.max(filters.minOwnCommits ?? 0, Math.min(n, 100_000));
    take(ctx, { kind: "commits", key: "commits", label: `${filters.minOwnCommits}+ own commits`, start: s, end: e });
  };
  scan(ctx, /(?:(?:at\s+least|min(?:imum)?|over|more\s+than|>=?|≥)\s*)?(\d{1,6})\s*\+?\s*(?:own\s+)?commits?\b/gi, (m, s, e) => commit(Number(m[1]), s, e));
  scan(ctx, /\b(?:own\s+)?commits?\s*(?:>=?|≥|over|above|of|at\s+least)?\s*(\d{1,6})\s*\+?/gi, (m, s, e) => commit(Number(m[1]), s, e));

  // 2. Minimum Proof Score: "score 70+", "proof score above 70", "70+ score", "scoring 80".
  const score = (n: number, s: number, e: number) => {
    filters.minScore = clampScore(Math.max(filters.minScore ?? 0, n));
    take(ctx, { kind: "score", key: "score", label: `Score ${filters.minScore}+`, start: s, end: e });
  };
  scan(ctx, /\b(?:(?:min(?:imum)?|at\s+least)\s+)?(?:proof\s*)?scor(?:e|es|ed|ing)\s*(?:of|>=?|≥|above|over|at\s+least|min(?:imum)?)?\s*(\d{1,3})\s*\+?/gi, (m, s, e) => score(Number(m[1]), s, e));
  scan(ctx, /\b(\d{1,3})\s*\+\s*(?:proof\s*)?scores?\b/gi, (m, s, e) => score(Number(m[1]), s, e));

  // 3. Graduation years: ranges first, then "class of 2026", "'26 grads", bare 20xx.
  const years = new Set<number>();
  const year = (ys: number[], s: number, e: number) => {
    const ok = ys.filter(plausibleYear);
    if (!ok.length) return;
    for (const y of ok) years.add(y);
    take(ctx, { kind: "year", key: `year:${ok.join("-")}`, label: ok.length > 1 ? `Class of ${ok[0]}–${ok.at(-1)}` : `Class of ${ok[0]}`, start: s, end: e });
  };
  scan(ctx, /\b(20\d{2})\s*(?:-|–|to)\s*(20\d{2})\b(?:\s*(?:grads?|graduates|batch|pass-?outs?))?/gi, (m, s, e) => {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (b < a || b - a > 9) {
      // Claim the span anyway so neither end is read as a single year.
      for (let i = s; i < e; i++) ctx.mask[i] = true;
      return;
    }
    year(Array.from({ length: b - a + 1 }, (_, i) => a + i), s, e);
  });
  scan(ctx, /\b(?:class\s+of|batch(?:\s+of)?|graduating(?:\s+in)?|grads?\s+of|graduates\s+of|passing\s+out(?:\s+in)?)\s*'?(\d{4}|\d{2})\b/gi, (m, s, e) => year([toYear(m[1] ?? "")], s, e));
  scan(ctx, /(?:^|(?<=\s))'(\d{2})\s*(?:grads?|graduates|batch|pass-?outs?)?\b/gi, (m, s, e) => year([toYear(m[1] ?? "")], s, e));
  scan(ctx, /\b(20\d{2})\b(?:\s*(?:grads?|graduates|batch|pass-?outs?))?/gi, (m, s, e) => year([Number(m[1])], s, e));

  // 4. Evidence flags.
  scan(ctx, /\b(?:(?:with|has|have)\s+)?(?:(?:a|an)\s+)?(?:live\s+(?:apps?|deployments?|sites?|websites?|projects?|products?)|deployed(?:\s+(?:apps?|projects?))?|deployments?|shipped(?:\s+(?:apps?|products?))?|in\s+production|live)\b/gi, (_m, s, e) => {
    filters.hasDeployment = true;
    take(ctx, { kind: "live", key: "live", label: "Live app", start: s, end: e });
  });
  scan(ctx, /\b(?:mentor[-\s]?endorsed|endorsed(?:\s+by\s+(?:a\s+)?(?:verified\s+)?mentors?)?|(?:mentor\s+)?endorsements?|vouched(?:\s+for)?)\b/gi, (_m, s, e) => {
    filters.mentorEndorsed = true;
    take(ctx, { kind: "endorsed", key: "endorsed", label: "Mentor-endorsed", start: s, end: e });
  });
  scan(ctx, /\b(?:(?:who\s+)?passed\s+(?:a\s+|any\s+|the\s+)?(?:skill\s+|coding\s+)?(?:checks?|tests?)|skill\s+checks?|checks?\s+passed)\b/gi, (_m, s, e) => {
    filters.passedCheck = true;
    take(ctx, { kind: "check", key: "check", label: "Passed a check", start: s, end: e });
  });

  // 5. Colleges: full name, short name, or its acronym ("SPIT" for "SPIT Surat").
  const collegeIds: string[] = [];
  const collegePhrases: { p: string; id: string; label: string }[] = [];
  for (const c of vocab.colleges ?? []) {
    collegePhrases.push({ p: c.name, id: c.id, label: c.shortName }, { p: c.shortName, id: c.id, label: c.shortName });
    const acronym = c.shortName.split(/\s+/)[0];
    if (acronym && acronym.length >= 3 && acronym === acronym.toUpperCase() && /[A-Z]/.test(acronym)) collegePhrases.push({ p: acronym, id: c.id, label: c.shortName });
  }
  collegePhrases.sort((a, b) => b.p.length - a.p.length);
  for (const cp of collegePhrases) {
    scan(ctx, new RegExp(`(?:\\b(?:at|from)\\s+)?${phrase(cp.p).source}`, "gi"), (_m, s, e) => {
      if (!collegeIds.includes(cp.id)) collegeIds.push(cp.id);
      take(ctx, { kind: "college", key: `college:${cp.id}`, label: cp.label, start: s, end: e });
    });
  }

  // 6. Skills: vocabulary names and slugs, plus the synonym table (restricted to known slugs).
  const known = vocab.skills?.length ? new Map(vocab.skills.map((s) => [s.slug, s.name])) : null;
  const skillPhrases: { p: string; slug: string; caseSensitive: boolean }[] = [];
  const addSkill = (p: string, slug: string) => {
    const lower = p.toLowerCase();
    if (!lower.trim()) return;
    const caseSensitive = CASE_SENSITIVE_NAMES.has(lower);
    // "go" typed in lower case is the verb; only "Go" (or "golang") means the language.
    if (caseSensitive && p === lower) return;
    skillPhrases.push({ p, slug, caseSensitive });
  };
  for (const [slug, def] of Object.entries(SKILL_SYNONYMS)) {
    if (known && !known.has(slug)) continue;
    for (const a of def.aliases) addSkill(a, slug);
    addSkill(def.name, slug);
  }
  for (const s of vocab.skills ?? []) {
    addSkill(s.name, s.slug);
    if (s.slug.length > 1) addSkill(s.slug.replace(/-/g, " "), s.slug);
  }
  skillPhrases.sort((a, b) => b.p.length - a.p.length);
  const skillList: string[] = [];
  for (const sp of skillPhrases) {
    scan(ctx, phrase(sp.p, sp.caseSensitive ? "g" : "gi"), (_m, s, e) => {
      take(ctx, { kind: "skill", key: `skill:${sp.slug}`, label: known?.get(sp.slug) ?? SKILL_SYNONYMS[sp.slug]?.name ?? sp.slug, start: s, end: e });
    });
  }

  // 7. Location: a known city anywhere, or a capitalised place after "in"/"from"/"based in".
  const cities = [...new Set([...KNOWN_CITIES, ...(vocab.colleges ?? []).map((c) => c.city).filter((c): c is string => !!c)])].sort((a, b) => b.length - a.length);
  const location = (name: string, s: number, e: number) => {
    if (filters.location) return;
    const canonical = CITY_ALIASES[name.toLowerCase()] ?? titleCase(name.toLowerCase());
    filters.location = canonical;
    take(ctx, { kind: "location", key: "location", label: canonical, start: s, end: e });
  };
  for (const city of cities) {
    scan(ctx, new RegExp(`(?:\\b(?:based\\s+in|located\\s+in|in|from|near|around)\\s+)?${phrase(city).source}`, "gi"), (m, s, e) => {
      const inner = new RegExp(phrase(city).source, "i").exec(m[0]);
      location(inner?.[0] ?? city, s, e);
    });
  }
  scan(ctx, /\b(?:based\s+in|located\s+in|in|from|near)\s+([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\b/g, (m, s, e) => location(m[1] ?? "", s, e));

  // 8. Leftover words stay as full-text, minus filler.
  const leftover: string[] = [];
  let word = "";
  const flush = () => {
    const w = word.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9+#.]+$/g, "");
    word = "";
    if (!w || STOPWORDS.has(w) || /^\d+\+?$/.test(w) || !/[a-z0-9]/.test(w)) return;
    leftover.push(w);
  };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i] ?? " ";
    if (ctx.mask[i] || /[\s,;!?()"“”]/.test(ch)) flush();
    else word += ch;
  }
  flush();
  const text = [...new Set(leftover)].join(" ").slice(0, 120).trim();

  // Skills in reading order, capped at the schema's eight.
  for (const c of [...ctx.chips].sort((a, b) => a.start - b.start)) {
    const slug = c.kind === "skill" ? c.key.slice(6) : null;
    if (slug && !skillList.includes(slug) && skillList.length < 8) skillList.push(slug);
  }
  ctx.chips = ctx.chips.filter((c) => c.kind !== "skill" || skillList.includes(c.key.slice(6)));
  if (skillList.length) filters.skills = skillList;
  if (collegeIds.length) filters.collegeIds = collegeIds.slice(0, 20);
  if (years.size) filters.graduationYears = [...years].sort((a, b) => a - b).slice(0, 10);
  if (text) filters.q = text;

  // Chips in reading order; one chip per key (the first occurrence) keeps the UI calm.
  const seen = new Set<string>();
  const chips = ctx.chips
    .sort((a, b) => a.start - b.start)
    .filter((c) => (seen.has(c.key) ? false : (seen.add(c.key), true)));

  return { filters, chips, text };
}

/** Remove every phrase that produced chips with this key, tidying the whitespace left behind. */
export function removeChip(input: string, chip: Pick<TalentChip, "key">, vocab: TalentVocab = {}): string {
  const all = parseAllSpans(input, vocab).filter((c) => c.key === chip.key);
  let out = input;
  for (const c of all.sort((a, b) => b.start - a.start)) out = out.slice(0, c.start) + " " + out.slice(c.end);
  return out
    .replace(/\s+([,.;])/g, "$1")
    .replace(/([,;])\s*([,;])+/g, "$1")
    .replace(/^[\s,;]+|[\s,;]+$/g, "")
    .replace(/\s{2,}/g, " ");
}

/** Every chip span, including repeats (parseTalentQuery de-duplicates for display). */
function parseAllSpans(input: string, vocab: TalentVocab): TalentChip[] {
  // Re-run the parser and recover repeated spans by masking the first occurrence until none remain.
  const spans: TalentChip[] = [];
  let text = input;
  for (let guard = 0; guard < 12; guard++) {
    const { chips } = parseTalentQuery(text, vocab);
    if (!chips.length) break;
    spans.push(...chips);
    // Blank out found spans (same length) so indexes stay valid for the original string.
    let next = text;
    for (const c of chips) next = next.slice(0, c.start) + " ".repeat(c.end - c.start) + next.slice(c.end);
    if (next === text) break;
    text = next;
  }
  return spans;
}

/** Combine rail filters with parsed ones: lists union, flags OR, thresholds take the stricter. */
export function mergeFilters(a: SearchFiltersInput, b: SearchFiltersInput): SearchFiltersInput {
  const union = <T>(x?: T[], y?: T[]) => {
    const u = [...new Set([...(x ?? []), ...(y ?? [])])];
    return u.length ? u : undefined;
  };
  const max = (x?: number, y?: number) => (x || y ? Math.max(x ?? 0, y ?? 0) : undefined);
  const q = [a.q, b.q].filter(Boolean).join(" ").trim().slice(0, 120);
  const out: SearchFiltersInput = {
    q: q || undefined,
    skills: union(a.skills, b.skills)?.slice(0, 8),
    minScore: max(a.minScore, b.minScore),
    hasDeployment: a.hasDeployment || b.hasDeployment || undefined,
    minOwnCommits: max(a.minOwnCommits, b.minOwnCommits),
    passedCheck: a.passedCheck || b.passedCheck || undefined,
    mentorEndorsed: a.mentorEndorsed || b.mentorEndorsed || undefined,
    collegeIds: union(a.collegeIds, b.collegeIds)?.slice(0, 20),
    graduationYears: union(a.graduationYears, b.graduationYears)?.slice(0, 10),
    location: b.location ?? a.location,
    sort: a.sort ?? b.sort,
  };
  for (const k of Object.keys(out) as (keyof SearchFiltersInput)[]) if (out[k] === undefined) delete out[k];
  return out;
}
