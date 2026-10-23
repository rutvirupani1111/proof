import type { ScoreBreakdown } from "@/db/schema";

type Signal = keyof Omit<ScoreBreakdown, "reasons">;

const PARTS: { key: Signal; label: string; tone: string }[] = [
  { key: "authorship", label: "Code authorship", tone: "bg-lime" },
  { key: "deployments", label: "Live deployments", tone: "bg-violet" },
  { key: "checks", label: "Skill checks", tone: "bg-ink" },
  { key: "endorsements", label: "Mentor endorsements", tone: "bg-violet/45" },
  { key: "recency", label: "Recency", tone: "bg-line-strong" },
];

/**
 * "Why 82?": the score as a stacked bar (segments sum to the score), each signal against its cap,
 * then the engine's own explanation lines. Never a black box.
 */
export function ScoreBreakdownPanel({
  score,
  breakdown,
  caps,
  explanation,
}: {
  score: number;
  breakdown: ScoreBreakdown | null;
  caps: Record<Signal, number>;
  explanation: string[];
}) {
  if (!breakdown) {
    return <p className="text-sm text-muted">The breakdown appears once the scoring engine has run on this profile.</p>;
  }
  const parts = PARTS.map((p) => ({ ...p, value: Math.max(0, Math.round(breakdown[p.key] ?? 0)), cap: caps[p.key] }));
  // The engine's first lines restate the per-signal totals shown above; keep only the reasons.
  const reasons = explanation.filter((line) => !PARTS.some((p) => line.startsWith(`${p.label}:`)));
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`Score ${score} of 100, broken down below`}>
        {parts.map((p) => (p.value > 0 ? <span key={p.key} className={p.tone} style={{ width: `${p.value}%` }} /> : null))}
      </div>
      <ul className="mt-4 grid gap-2 text-sm">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-2.5">
            <span className={`size-2.5 rounded-sm ${p.tone}`} aria-hidden />
            <span className="flex-1">{p.label}</span>
            <span className="font-mono text-muted tabular">
              +{p.value}
              <span className="text-subtle"> / {p.cap}</span>
            </span>
          </li>
        ))}
        <li className="flex items-center gap-2.5 border-t border-dashed border-line-strong pt-2 font-medium">
          <span className="size-2.5" aria-hidden />
          <span className="flex-1">Proof Score</span>
          <span className="font-mono tabular text-verified">{score}</span>
        </li>
      </ul>
      {reasons.length > 0 && (
        <ul className="mt-4 grid gap-1.5 text-[13px] leading-snug text-muted">
          {reasons.slice(0, 8).map((r) => (
            <li key={r} className="flex gap-2">
              <span className="text-verified" aria-hidden>
                ·
              </span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
