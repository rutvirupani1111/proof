"use client";

import { ArrowLeftRight, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { signOut } from "@/lib/auth/client";
import { DEMO_ACCOUNTS, DEMO_MODE, demoAccountForEmail, type DemoKey } from "@/lib/demo";
import { demoSignIn } from "@/server/demo/actions";
import { ROLE_ICON } from "./role-icon";

/**
 * Floating "Switch role" pill for signed-in demo accounts: one tap signs out and back in as
 * another pinned demo role. Renders nothing outside demo mode or for non-demo users.
 */
export function DemoRoleSwitcher({ email }: { email: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const current = demoAccountForEmail(email);
  if (!DEMO_MODE || !current) return null;
  const currentKey = current.key;

  async function switchTo(key: DemoKey) {
    if (key === currentKey || busy) return;
    setBusy(true);
    await signOut().catch(() => undefined);
    const res = await demoSignIn(key);
    if (!res.ok) {
      setBusy(false);
      toast.error(res.error);
      router.replace("/login");
      return;
    }
    router.replace(res.home);
    router.refresh();
    setBusy(false);
  }

  const CurrentIcon = ROLE_ICON[current.role];
  return (
    <div className="fixed bottom-4 left-4 z-40 print:hidden lg:left-[17rem]">
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={busy}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-line-strong bg-surface/95 py-1 pr-3.5 pl-1.5 text-[13px] font-medium text-ink shadow-pop backdrop-blur transition hover:bg-surface-2 disabled:opacity-70 data-[state=open]:bg-surface-2"
          aria-label={`Demo: signed in as ${current.label}. Switch role`}
        >
          <span className="grid size-7 place-items-center rounded-full bg-lime text-lime-ink" aria-hidden>
            <CurrentIcon className="size-3.5" />
          </span>
          <span className="hidden font-mono text-[10.5px] tracking-wider text-subtle uppercase sm:inline">Demo</span>
          <span>{busy ? "Switching…" : "Switch role"}</span>
          <ArrowLeftRight className="size-3.5 text-subtle" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-72">
          <DropdownMenuLabel>Sign in as another demo role</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {DEMO_ACCOUNTS.map((a) => {
            const Icon = ROLE_ICON[a.role];
            const active = a.key === currentKey;
            return (
              <DropdownMenuItem key={a.key} disabled={active} onSelect={() => switchTo(a.key)} className="gap-3 py-2">
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{a.name}</span>
                  <span className="block truncate text-xs text-muted">{a.label}</span>
                </span>
                {active && <Check className="size-4 text-verified" aria-hidden />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
