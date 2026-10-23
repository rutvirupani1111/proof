"use client";

import { AnimatePresence, motion } from "motion/react";
import { BellRing, CheckCircle2, PartyPopper } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { springs } from "@/components/motion/transitions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { NUDGE_GAPS, type NudgeGap } from "@/lib/validation/college";
import { nudgeStudentsAction } from "@/server/college/actions";

type Student = {
  userId: string;
  name: string;
  image: string | null;
  branch: string | null;
  graduationYear: number | null;
  proofScore: number;
  gaps: NudgeGap[];
};

const GAP_LABEL: Record<NudgeGap, string> = {
  github: "No GitHub proof",
  repo: "No verified repo",
  deployment: "No live app",
  check: "No passed check",
  endorsement: "No endorsement",
};

export function NudgeView({ students, total }: { students: Student[]; total: number }) {
  const [gap, setGap] = useState<NudgeGap | "any">("any");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  const counts = useMemo(() => {
    const c = Object.fromEntries(NUDGE_GAPS.map((g) => [g, 0])) as Record<NudgeGap, number>;
    for (const s of students) for (const g of s.gaps) c[g] += 1;
    return c;
  }, [students]);
  const shown = gap === "any" ? students : students.filter((s) => s.gaps.includes(gap));
  const allOn = shown.length > 0 && shown.every((s) => selected.has(s.userId));

  if (students.length === 0) {
    return <EmptyState icon={PartyPopper} title="Every student has a complete set of proofs" description={`All ${total} students have GitHub, code, a live app, a passed check and an endorsement.`} />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by missing proof">
          {(["any", ...NUDGE_GAPS] as const).map((g) => (
            <button
              key={g}
              role="tab"
              aria-selected={gap === g}
              onClick={() => setGap(g)}
              className={cn("relative rounded-full border px-3 py-1 text-xs transition-colors", gap === g ? "border-transparent text-canvas" : "border-line text-muted hover:text-ink")}
            >
              {gap === g && <motion.span layoutId="gap-pill" transition={springs.snappy} className="absolute inset-0 rounded-full bg-ink" />}
              <span className="relative">
                {g === "any" ? "Any gap" : GAP_LABEL[g]} <span className="font-mono opacity-70">{g === "any" ? students.length : counts[g]}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-card">
          <label className="flex items-center gap-3 border-b border-line bg-surface-2/60 px-4 py-2.5 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[var(--violet)] max-sm:size-5"
              checked={allOn}
              onChange={() =>
                setSelected((cur) => {
                  const next = new Set(cur);
                  for (const s of shown) {
                    if (allOn) next.delete(s.userId);
                    else next.add(s.userId);
                  }
                  return next;
                })
              }
            />
            Select all {shown.length}
          </label>
          <ul className="divide-y divide-line">
            <AnimatePresence initial={false}>
              {shown.map((s) => (
                <motion.li key={s.userId} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={springs.layout}>
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
                    <input
                      type="checkbox"
                      className="size-4 shrink-0 accent-[var(--violet)] max-sm:size-5"
                      checked={selected.has(s.userId)}
                      onChange={() =>
                        setSelected((cur) => {
                          const next = new Set(cur);
                          if (next.has(s.userId)) next.delete(s.userId);
                          else next.add(s.userId);
                          return next;
                        })
                      }
                    />
                    <Avatar name={s.name} src={s.image} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <span className="truncate">{s.name}</span>
                        {sent.has(s.userId) && <CheckCircle2 className="size-4 shrink-0 text-verified" aria-label="Nudged" />}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {s.gaps.map((g) => (
                          <span key={g} className={cn("rounded px-1.5 py-0.5 text-[11px]", g === gap ? "bg-coral-soft text-coral-text" : "bg-surface-2 text-muted")}>
                            {GAP_LABEL[g]}
                          </span>
                        ))}
                      </span>
                    </span>
                    <span className="hidden font-mono text-xs text-muted sm:inline">{s.branch}</span>
                    <span className="font-mono text-xs font-semibold tabular">{s.proofScore}</span>
                  </label>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      </div>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card">
          <p className="font-display text-lg font-semibold">
            <span className="tabular">{selected.size}</span> selected
          </p>
          <p className="mt-1 text-sm text-muted">Leave the message empty and each student gets a personalised next step, e.g. “verify a live deployment, then pass a skill check”.</p>
          <Field label="Custom message (optional)" htmlFor="nudge-msg" className="mt-4">
            <Textarea id="nudge-msg" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={280} className="min-h-20" placeholder="Drives open next week. Finish your proofs to be eligible." />
          </Field>
          <Button
            className="mt-4 w-full"
            disabled={selected.size === 0}
            loading={pending}
            onClick={() =>
              start(async () => {
                const ids = [...selected];
                const res = await nudgeStudentsAction({ studentUserIds: ids, message: message || undefined });
                if (!res.ok) return void toast.error(res.error);
                setSent((cur) => new Set([...cur, ...ids]));
                setSelected(new Set());
                toast.success(`Nudged ${res.data.sent} student${res.data.sent === 1 ? "" : "s"}`);
              })
            }
          >
            <BellRing /> Send nudge
          </Button>
        </div>
      </aside>
    </div>
  );
}
