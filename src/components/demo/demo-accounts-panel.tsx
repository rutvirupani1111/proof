"use client";

import { ArrowRight, KeyRound } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { safeNext } from "@/lib/auth/roles";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, type DemoKey } from "@/lib/demo";
import { cn } from "@/lib/utils";
import { demoSignIn } from "@/server/demo/actions";
import { CopyButton } from "./copy-button";
import { ROLE_ICON } from "./role-icon";

/**
 * Pinned demo logins under the sign-in form (rendered only when DEMO_MODE is on). Each card signs
 * in with one tap through `demoSignIn`, and shows the email and shared password with copy buttons
 * for anyone who would rather type them into the form.
 */
export function DemoAccountsPanel() {
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState<DemoKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function enter(key: DemoKey) {
    setBusy(key);
    setError(null);
    const res = await demoSignIn(key);
    if (!res.ok) {
      setBusy(null);
      setError(res.error);
      return;
    }
    startTransition(() => {
      router.replace(safeNext(params.get("next")) ?? res.home);
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="demo-accounts-title" className="mt-10 rounded-2xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="demo-accounts-title" className="font-display text-base font-semibold tracking-tight">
            Demo accounts
          </h2>
          <p className="mt-0.5 text-xs text-muted">Fictional showcase data. Tap a role to sign in.</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line bg-surface-2 py-0.5 pr-0.5 pl-2 font-mono text-[11px] text-muted">
          <KeyRound className="size-3" aria-hidden />
          {DEMO_PASSWORD}
          <CopyButton value={DEMO_PASSWORD} label="demo password" className="size-6 min-h-0 min-w-0" />
        </span>
      </div>

      <ul className="mt-4 grid gap-2">
        {DEMO_ACCOUNTS.map((a) => {
          const Icon = ROLE_ICON[a.role];
          const loading = busy === a.key;
          return (
            <li
              key={a.key}
              className={cn(
                "rounded-xl border border-line bg-canvas p-3 transition-colors hover:border-line-strong",
                loading && "border-lime ring-2 ring-lime/30",
              )}
            >
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink" aria-hidden>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{a.name}</p>
                  <p className="truncate font-mono text-[10.5px] tracking-wider text-subtle uppercase">{a.label}</p>
                </div>
                <button
                  type="button"
                  onClick={() => enter(a.key)}
                  disabled={busy !== null}
                  aria-label={`Sign in as ${a.name}, ${a.label}`}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-lime px-3 text-[13px] font-semibold text-lime-ink transition hover:brightness-[1.04] disabled:opacity-60"
                >
                  {loading ? "Signing in…" : "Sign in"}
                  {!loading && <ArrowRight className="size-3.5" aria-hidden />}
                </button>
              </div>
              <p className="mt-2 text-xs text-muted">{a.blurb}</p>
              <dl className="mt-2 grid gap-1 font-mono text-[11.5px]">
                <div className="flex items-center gap-2">
                  <dt className="w-16 shrink-0 text-subtle">Email</dt>
                  <dd className="min-w-0 flex-1 truncate text-ink">{a.email}</dd>
                  <CopyButton value={a.email} label={`${a.name} email`} className="min-h-0 min-w-0" />
                </div>
                <div className="flex items-center gap-2">
                  <dt className="w-16 shrink-0 text-subtle">Password</dt>
                  <dd className="min-w-0 flex-1 truncate text-ink">{DEMO_PASSWORD}</dd>
                  <CopyButton value={DEMO_PASSWORD} label="password" className="min-h-0 min-w-0" />
                </div>
              </dl>
            </li>
          );
        })}
      </ul>
      {error && (
        <p role="alert" className="mt-3 rounded-xl border border-coral/30 bg-coral-soft px-3 py-2 text-sm text-coral-text">
          {error}
        </p>
      )}
    </section>
  );
}
