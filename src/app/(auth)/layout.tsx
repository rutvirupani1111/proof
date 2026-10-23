import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Seal } from "@/components/ui/seal";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,34rem)]">
      <aside className="relative hidden overflow-hidden border-r border-line bg-surface-2 lg:block">
        <div className="absolute inset-0 bg-dots opacity-60" aria-hidden />
        <div className="relative flex h-full flex-col justify-between p-10">
          <Logo />
          <div className="max-w-md">
            <Seal size={112} stamp="mount" delay={0.3} />
            <p className="mt-8 font-display text-4xl leading-[1.05] font-semibold tracking-tight text-balance">
              Resumes are claims. <span className="text-verified">Proof is evidence.</span>
            </p>
            <p className="mt-4 text-muted">
              Real code, live projects, passed skill checks and endorsements from verified mentors. Signed, so anyone can check.
            </p>
          </div>
          <p className="font-mono text-xs text-subtle">Every credential on Proof is independently verifiable.</p>
        </div>
      </aside>
      <main className="flex flex-col px-4 py-6 sm:px-10">
        <div className="flex items-center justify-between lg:justify-end">
          <Logo className="lg:hidden" />
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}
