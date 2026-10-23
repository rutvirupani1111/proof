/**
 * Proof Replay: a week-by-week time-lapse of a student's verified work. Pure and client-safe.
 *
 * Each week's score is the real engine re-run on the work that existed by the end of that week:
 * repo authorship accrues linearly across the repo's verified first-to-last commit span (we
 * store totals, not per-commit history, so commits are spread evenly over its active weeks);
 * deployments, checks and endorsements land in the week they were verified.
 */
import { computeScore, type ScoreItem } from "./engine";

const WEEK = 7 * 86_400_000;

export type RepoSpan = { first: Date | null; last: Date | null };
export type ReplayKind = "commit" | "deployment" | "check" | "endorsement" | "github";
export type ReplayEvent = { id: string; kind: ReplayKind; title: string; week: number; count: number };
export type ReplayWeek = { week: number; start: string; score: number; commits: number };
export type Replay = { weeks: ReplayWeek[]; events: ReplayEvent[]; finalScore: number };

const KIND: Record<ScoreItem["kind"], ReplayKind> = {
  github_ownership: "github",
  repo_authorship: "commit",
  deployment: "deployment",
  skill_check: "check",
  attestation: "endorsement",
};

/** Monday 00:00 UTC of the week containing `d`. */
export function weekStart(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (x.getUTCDay() + 6) % 7;
  return new Date(x.getTime() - dow * 86_400_000);
}

export function buildReplay(items: ScoreItem[], spans: Record<string, RepoSpan>, now = new Date(), maxWeeks = 104): Replay {
  const spanOf = (i: ScoreItem & { kind: "repo_authorship" }) => {
    const s = spans[i.id];
    const last = s?.last ?? i.at ?? now;
    const first = s?.first ?? new Date(last.getTime() - Math.max(0, i.activeWeeks - 1) * WEEK);
    return { first: first.getTime() <= last.getTime() ? first : last, last };
  };

  const dates: number[] = [];
  for (const i of items) {
    if (i.kind === "repo_authorship") dates.push(spanOf(i).first.getTime());
    else if (i.at) dates.push(i.at.getTime());
  }
  if (!dates.length) return { weeks: [], events: [], finalScore: 0 };

  const end = weekStart(now).getTime();
  let start = weekStart(new Date(Math.min(...dates))).getTime();
  start = Math.max(start, end - (maxWeeks - 1) * WEEK);
  const n = Math.round((end - start) / WEEK) + 1;
  const weekOf = (t: number) => Math.max(0, Math.min(n - 1, Math.floor((t - start) / WEEK)));

  // Events, in order.
  const events: ReplayEvent[] = [];
  for (const i of items) {
    if (i.kind === "repo_authorship") {
      const { first, last } = spanOf(i);
      const k = Math.max(1, i.activeWeeks);
      const per = new Map<number, number>();
      for (let j = 0; j < k; j++) {
        const t = k === 1 ? last.getTime() : first.getTime() + ((last.getTime() - first.getTime()) * j) / (k - 1);
        const w = weekOf(t);
        per.set(w, (per.get(w) ?? 0) + i.ownCommits / k);
      }
      for (const [w, c] of per) events.push({ id: `${i.id}:${w}`, kind: "commit", title: i.title, week: w, count: Math.max(1, Math.round(c)) });
    } else if (i.at) {
      events.push({ id: i.id, kind: KIND[i.kind], title: i.title, week: weekOf(i.at.getTime()), count: 1 });
    }
  }
  events.sort((a, b) => a.week - b.week || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));

  // Score per week: the engine, on the work that existed by the end of the week.
  const weeks: ReplayWeek[] = [];
  for (let w = 0; w < n; w++) {
    const weekEnd = start + (w + 1) * WEEK - 1;
    const asOf: ScoreItem[] = [];
    for (const i of items) {
      if (i.kind === "repo_authorship") {
        const { first, last } = spanOf(i);
        if (first.getTime() > weekEnd) continue;
        const span = last.getTime() - first.getTime();
        const f = span <= 0 ? 1 : Math.min(1, (weekEnd - first.getTime()) / span);
        asOf.push({
          ...i,
          ownCommits: Math.round(i.ownCommits * f),
          activeWeeks: Math.max(1, Math.round(i.activeWeeks * f)),
          at: i.at && i.at.getTime() <= weekEnd ? i.at : new Date(Math.min(last.getTime(), weekEnd)),
        });
      } else if (i.at && i.at.getTime() <= weekEnd) {
        asOf.push(i);
      }
    }
    const commits = events.filter((e) => e.kind === "commit" && e.week === w).reduce((s, e) => s + e.count, 0);
    weeks.push({ week: w, start: new Date(start + w * WEEK).toISOString(), score: computeScore(asOf, new Date(Math.min(weekEnd, now.getTime()))).overall, commits });
  }

  return { weeks, events, finalScore: weeks.at(-1)?.score ?? 0 };
}
