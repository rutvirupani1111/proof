import { BadgeCheck, GitCommitHorizontal, Globe, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export type Facts = { liveDeployments: number; ownCommits: number; passedChecks: number; endorsements: number };

/** Four evidence counters, in the same order everywhere. Zero values are dimmed, never hidden. */
export function EvidenceFacts({ facts, className, compact }: { facts: Facts; className?: string; compact?: boolean }) {
  const items = [
    { icon: GitCommitHorizontal, value: facts.ownCommits, label: "own commits" },
    { icon: Globe, value: facts.liveDeployments, label: facts.liveDeployments === 1 ? "live app" : "live apps" },
    { icon: BadgeCheck, value: facts.passedChecks, label: facts.passedChecks === 1 ? "check passed" : "checks passed" },
    { icon: ShieldCheck, value: facts.endorsements, label: facts.endorsements === 1 ? "endorsement" : "endorsements" },
  ];
  return (
    <ul className={cn("flex flex-wrap gap-x-3 gap-y-1.5 text-xs", className)}>
      {items.map(({ icon: Icon, value, label }) => (
        <li key={label} className={cn("inline-flex items-center gap-1.5", value > 0 ? "text-ink" : "text-subtle")}>
          <Icon className={cn("size-3.5", value > 0 ? "text-verified" : "text-subtle")} aria-hidden />
          <span className="font-mono tabular font-medium">{value}</span>
          {!compact && <span className="text-muted">{label}</span>}
          {compact && <span className="sr-only">{label}</span>}
        </li>
      ))}
    </ul>
  );
}
