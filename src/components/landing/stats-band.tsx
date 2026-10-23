import { NumberTicker } from "@/components/motion";
import type { LandingStats } from "@/server/public/queries";

/** Social proof as numbers only (no testimonials): live counts from the evidence ledger. */
export function StatsBand({ stats }: { stats: LandingStats }) {
  const items = [
    { value: stats.verifiedEvidence, label: "verified evidence items", note: "each one sealed" },
    { value: stats.ownCommits, label: "own commits authenticated", note: "authorship, not stars" },
    { value: stats.liveDeployments, label: "live deployments", note: "token-proven, health-checked" },
    { value: stats.checksPassed, label: "skill checks passed", note: "hidden tests, sandboxed" },
    { value: stats.verifiedMentors, label: "domain-verified mentors", note: "real institutional email" },
    { value: stats.colleges, label: "colleges on Proof", note: `${stats.students} students` },
  ];
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line lg:grid-cols-3">
      {items.map((it) => (
        <div key={it.label} className="bg-surface p-5 sm:p-7">
          <dt className="sr-only">{it.label}</dt>
          <dd>
            <NumberTicker value={it.value} className="font-display text-3xl font-semibold tracking-tight tabular sm:text-5xl" />
            <p className="mt-2 text-sm font-medium">{it.label}</p>
            <p className="mt-0.5 font-mono text-[11px] text-subtle">{it.note}</p>
          </dd>
        </div>
      ))}
    </dl>
  );
}
