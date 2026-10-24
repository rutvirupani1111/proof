"use client";

import { passwordStrength } from "@/lib/password-strength";
import { cn } from "@/lib/utils";

const BAR = ["bg-line", "bg-coral", "bg-amber-500", "bg-violet", "bg-lime"];

/** Four-segment meter under a new-password field. */
export function PasswordStrength({ password, id }: { password: string; id?: string }) {
  const s = passwordStrength(password);
  return (
    <div id={id} aria-live="polite" className="grid gap-1.5">
      <div className="grid grid-cols-4 gap-1" aria-hidden>
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={cn("h-1.5 rounded-full transition-colors duration-300", s.score >= n ? BAR[s.score] : "bg-line")} />
        ))}
      </div>
      <p className="text-xs text-muted">
        {s.label && <span className="font-medium text-ink">{s.label}. </span>}
        {s.hint}
      </p>
    </div>
  );
}
