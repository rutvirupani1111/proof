import { Clock, Code2, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SealGlyph } from "@/components/ui/seal-glyph";
import { cn } from "@/lib/utils";
import { requireRole } from "@/server/auth/guard";
import { getChecksList } from "@/server/student/proofs";

export const metadata: Metadata = { title: "Skill checks" };

const LEVELS = [
  { key: "beginner", label: "Beginner", note: "About 15 minutes, worth up to 5 points." },
  { key: "intermediate", label: "Intermediate", note: "20-25 minutes, worth up to 8 points." },
  { key: "advanced", label: "Advanced", note: "Async and concurrency, worth up to 11 points." },
] as const;

export default async function ChecksPage() {
  const user = await requireRole("student", "/student/checks");
  const checks = await getChecksList(user.id);
  const passed = checks.filter((c) => c.passed).length;

  return (
    <>
      <PageHeader
        eyebrow="Evidence"
        title="Skill checks"
        description="Timed JavaScript tasks in the browser. Your code is graded on our server inside a WebAssembly sandbox against hidden tests: no network, no tricks, just whether it works."
        actions={
          <Badge variant="verified" className="px-3 py-1 text-sm">
            {passed} of {checks.length} passed
          </Badge>
        }
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          { icon: Clock, t: "Timed", d: "The clock starts when you open a check. Overtime submissions are recorded but do not count." },
          { icon: ShieldCheck, t: "Graded server-side", d: "QuickJS sandbox, memory and time limits, hidden tests never leave the server." },
          { icon: Code2, t: "Signals, not penalties", d: "Paste and tab-switch counts are shown to recruiters, never auto-penalised." },
        ].map((x) => (
          <div key={x.t} className="flex gap-3 rounded-[var(--radius-card)] border border-line bg-surface-2 p-4">
            <x.icon className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
            <div>
              <p className="text-sm font-medium">{x.t}</p>
              <p className="text-xs text-pretty text-muted">{x.d}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-8">
        {LEVELS.map((level) => {
          const list = checks.filter((c) => c.level === level.key);
          if (!list.length) return null;
          return (
            <section key={level.key} aria-labelledby={`lvl-${level.key}`}>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 id={`lvl-${level.key}`} className="font-display text-lg font-semibold">
                  {level.label}
                </h2>
                <p className="text-xs text-muted">{level.note}</p>
              </div>
              <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((c) => (
                  <StaggerItem key={c.id}>
                    <Link href={`/student/checks/${c.slug}`} className="block h-full rounded-[var(--radius-card)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                      <Card variant={c.passed ? "verified" : "default"} interactive className="flex h-full flex-col p-5">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-display text-base leading-tight font-semibold">{c.title}</h3>
                          {c.passed ? (
                            <SealGlyph className="size-6 shrink-0 text-verified" />
                          ) : c.invited ? (
                            <Badge variant="violet">Invited</Badge>
                          ) : c.inProgress ? (
                            <Badge variant="coral">In progress</Badge>
                          ) : null}
                        </div>
                        <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted">{c.prompt}</p>
                        <div className="mt-4 flex items-center justify-between gap-2 text-xs text-subtle">
                          <span className="flex items-center gap-2">
                            {c.skillName && <Badge>{c.skillName}</Badge>}
                            <span className="flex items-center gap-1">
                              <Clock className="size-3" /> {Math.round(c.timeLimitSec / 60)} min
                            </span>
                          </span>
                          {c.best != null && (
                            <span className={cn("font-mono tabular", c.passed ? "text-verified" : "text-coral-text")}>
                              best {c.best} · {c.attempts}×
                            </span>
                          )}
                        </div>
                      </Card>
                    </Link>
                  </StaggerItem>
                ))}
              </Stagger>
            </section>
          );
        })}
      </div>
    </>
  );
}
