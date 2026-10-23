import { MailCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Shown wherever endorsing is blocked because the mentor's domain is not verified yet. */
export function VerifyBanner({ hasProfile }: { hasProfile: boolean }) {
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-[var(--radius-card)] border border-coral/30 bg-coral-soft p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface text-coral-text shadow-card">
          <MailCheck className="size-4" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-medium text-ink">
            {hasProfile ? "Verify your institutional domain to start endorsing" : "Set up your mentor profile to start endorsing"}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Students and recruiters see your endorsement as &ldquo;Verified mentor at @your-domain&rdquo;. That claim needs proof too.
          </p>
        </div>
      </div>
      <Button asChild size="sm" variant="ink" className="w-full sm:w-auto">
        <Link href="/mentor/settings">{hasProfile ? "Verify domain" : "Set up profile"}</Link>
      </Button>
    </div>
  );
}
