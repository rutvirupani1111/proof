import { ArrowUpRight, ShieldAlert, ShieldX } from "lucide-react";
import Link from "next/link";
import { KIND_META } from "@/components/profile/kind-meta";
import { rosettePath } from "@/components/ui/seal-glyph";
import { Seal } from "@/components/ui/seal";
import { cn } from "@/lib/utils";
import type { VerifyView } from "@/server/public/verify";
import { JsonView } from "./json-view";

const GOOD = new Set(["valid"]);

const HEADLINE: Record<VerifyView["status"], string> = {
  valid: "Authentic. Signature verified.",
  tampered: "Tampered. Do not trust this.",
  revoked: "Revoked by Proof.",
  expired: "Expired.",
  not_found: "Unknown credential.",
  invalid: "Not a credential.",
};

const BROKEN = rosettePath(50, 50, 49, 45.5, 36);

/** A coral, cracked seal: the "tampered / unknown" counterpart of the lime stamp. */
function BrokenSeal({ size = 104 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="Not verified" className="-rotate-6">
      <path d={BROKEN} fill="var(--coral-soft)" stroke="var(--coral)" strokeWidth="1.5" strokeDasharray="3 3" />
      <circle cx="50" cy="50" r="30" fill="none" stroke="var(--coral)" strokeWidth="1.5" />
      <path d="M38 38l24 24M62 38L38 62" stroke="var(--coral-text)" strokeWidth="6" strokeLinecap="round" />
      <path d="M50 4l-6 18 9 6-7 16" fill="none" stroke="var(--canvas)" strokeWidth="2.5" />
    </svg>
  );
}

function when(iso: string | null) {
  if (!iso) return "n/a";
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) + " IST";
}

export function VerifyResult({ view, compact = false }: { view: VerifyView; compact?: boolean }) {
  const good = GOOD.has(view.status);
  const kind = view.claim ? KIND_META[view.claim.kind as keyof typeof KIND_META] : undefined;
  return (
    <div className="grid gap-5">
      <div
        className={cn(
          "relative overflow-hidden rounded-[var(--radius-card)] border p-6 shadow-card sm:p-8",
          good ? "border-verified/40 bg-surface ring-1 ring-lime/30" : "border-coral/40 bg-coral-soft/40 ring-1 ring-coral/20",
        )}
        role="status"
      >
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          {good ? <Seal size={compact ? 84 : 112} stamp="mount" delay={0.15} /> : <BrokenSeal size={compact ? 84 : 108} />}
          <div className="min-w-0">
            <p className={cn("flex items-center gap-1.5 font-mono text-[11px] tracking-[0.14em] uppercase", good ? "text-verified" : "text-coral-text")}>
              {good ? "Verified" : view.status === "tampered" ? <><ShieldAlert className="size-3.5" aria-hidden /> Signature check failed</> : <><ShieldX className="size-3.5" aria-hidden /> Not verified</>}
            </p>
            <h2 className={cn("mt-1.5 font-semibold text-balance", compact ? "text-xl" : "text-2xl sm:text-3xl")}>{HEADLINE[view.status]}</h2>
            <p className="mt-1.5 text-sm text-pretty text-muted">{view.reason}</p>
            {view.changedFields && view.changedFields.length > 0 && (
              <p className="mt-2 flex flex-wrap gap-1.5">
                {view.changedFields.map((f) => (
                  <code key={f} className="rounded-md bg-coral-soft px-1.5 py-0.5 font-mono text-[11px] text-coral-text">
                    {f}
                  </code>
                ))}
              </p>
            )}
          </div>
        </div>
      </div>

      {view.claim && (
        <dl className="grid overflow-hidden rounded-[var(--radius-card)] border border-line bg-line sm:grid-cols-2 [&>div]:bg-surface [&>div]:p-4 gap-px">
          <div className="sm:col-span-2">
            <dt className="text-[11px] text-subtle">Claim</dt>
            <dd className="mt-1 font-display text-lg font-semibold">{view.claim.title}</dd>
            <dd className="mt-1 text-xs text-muted">
              {kind?.label ?? view.claim.kind}
              {view.claim.skills.length > 0 && <> · proves {view.claim.skills.join(", ")}</>}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-subtle">Subject</dt>
            <dd className="mt-1 font-medium">
              {view.subject?.handle ? (
                <Link href={`/u/${view.subject.handle}`} className="inline-flex items-center gap-0.5 hover:underline">
                  {view.subject.name} <ArrowUpRight className="size-3.5" aria-hidden />
                </Link>
              ) : (
                (view.subject?.name ?? "n/a")
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-subtle">Issuer</dt>
            <dd className="mt-1 font-medium">{view.issuer?.name ?? "Proof"}</dd>
            <dd className="truncate font-mono text-[11px] text-subtle" title={view.issuer?.id}>
              {view.issuer?.id} · key {view.issuer?.keyId}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-subtle">Issued</dt>
            <dd className="mt-1 font-mono text-[13px]">{when(view.issuedAt)}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-subtle">{view.revokedAt ? "Revoked" : "Expires"}</dt>
            <dd className={cn("mt-1 font-mono text-[13px]", view.revokedAt && "text-coral-text")}>
              {view.revokedAt ? when(view.revokedAt) : view.expiresAt ? when(view.expiresAt) : "Never"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[11px] text-subtle">Signature (Ed25519, eddsa-jcs-2022)</dt>
            <dd className="mt-1 font-mono text-[11.5px] break-all text-muted">{view.signature ?? "No signature attached."}</dd>
          </div>
        </dl>
      )}

      {view.checks.length > 0 && (
        <ul className="grid gap-1.5 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-5" aria-label="Individual checks">
          {view.checks.map((c) => (
            <li key={c.label} className="flex items-center gap-2.5 text-sm">
              <span
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                  c.ok ? "bg-lime text-lime-ink" : "bg-coral text-white",
                )}
                aria-hidden
              >
                {c.ok ? "✓" : "✕"}
              </span>
              <span className={c.ok ? undefined : "text-coral-text"}>{c.label}</span>
              <span className="sr-only">{c.ok ? "passed" : "failed"}</span>
            </li>
          ))}
        </ul>
      )}

      {view.vc && <JsonView value={view.vc} label={compact ? "Document checked" : "Raw credential JSON"} />}
    </div>
  );
}
