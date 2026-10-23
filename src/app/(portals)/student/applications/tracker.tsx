"use client";

import { Check, CircleSlash, MapPin, Undo2, XCircle } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { springs } from "@/components/motion/transitions";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { SealGlyph } from "@/components/ui/seal-glyph";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { cn, timeAgo } from "@/lib/utils";
import type { TrackedApplication } from "@/server/student/jobs";
import { withdrawApplication } from "@/server/student/job-actions";
import { EMPLOYMENT_LABEL, WORK_MODE_LABEL, formatDate } from "../jobs/format";

const STEPS = [
  { stage: "applied", label: "Applied" },
  { stage: "screening", label: "Screening" },
  { stage: "skill_check", label: "Skill check" },
  { stage: "interview", label: "Interview" },
  { stage: "offer", label: "Offer" },
  { stage: "hired", label: "Hired" },
] as const;

const WITHDRAWABLE = new Set(["applied", "screening", "skill_check", "interview"]);
const CLOSED = new Set(["rejected", "withdrawn", "hired"]);

export function ApplicationsTracker({ applications }: { applications: TrackedApplication[] }) {
  const active = applications.filter((a) => !CLOSED.has(a.stage));
  const closed = applications.filter((a) => CLOSED.has(a.stage));
  const [confirm, setConfirm] = useState<TrackedApplication | null>(null);

  return (
    <>
      <Tabs defaultValue={active.length ? "active" : "closed"}>
        <TabsList>
          <TabsTrigger value="active">
            Active <span className="font-mono text-[11px] text-subtle tabular">{active.length}</span>
          </TabsTrigger>
          <TabsTrigger value="closed">
            Closed <span className="font-mono text-[11px] text-subtle tabular">{closed.length}</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="active">
          <List items={active} empty="No active applications. Withdrawn, rejected and hired ones live under Closed." onWithdraw={setConfirm} />
        </TabsContent>
        <TabsContent value="closed">
          <List items={closed} empty="Nothing closed yet." onWithdraw={setConfirm} />
        </TabsContent>
      </Tabs>
      <WithdrawDialog app={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}

function List({
  items,
  empty,
  onWithdraw,
}: {
  items: TrackedApplication[];
  empty: string;
  onWithdraw: (a: TrackedApplication) => void;
}) {
  if (items.length === 0) return <EmptyState className="py-10" title={empty} />;
  return (
    <LayoutGroup>
      <ul className="grid gap-3">
        <AnimatePresence initial={false} mode="popLayout">
          {items.map((a, i) => (
            <motion.li
              key={a.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { ...springs.gentle, delay: Math.min(i, 8) * 0.04 } }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={springs.layout}
            >
              <ApplicationCard app={a} onWithdraw={() => onWithdraw(a)} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </LayoutGroup>
  );
}

function ApplicationCard({ app, onWithdraw }: { app: TrackedApplication; onWithdraw: () => void }) {
  const terminal = app.stage === "rejected" || app.stage === "withdrawn";
  const current = STEPS.findIndex((s) => s.stage === app.stage);

  return (
    <article className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card sm:p-5" aria-label={`${app.job.title} at ${app.company.name}`}>
      <div className="flex flex-wrap items-start gap-3">
        <Avatar name={app.company.name} size="md" className="rounded-xl" />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[15px] leading-snug font-semibold">{app.job.title}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-muted">
            <span className="inline-flex items-center gap-1">
              {app.company.name}
              {app.company.verified && (
                <>
                  <SealGlyph className="size-3.5 text-lime" />
                  <span className="sr-only">Verified company</span>
                </>
              )}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" aria-hidden />
              {app.job.location} · {WORK_MODE_LABEL[app.job.workMode as keyof typeof WORK_MODE_LABEL] ?? app.job.workMode}
            </span>
            <span>{EMPLOYMENT_LABEL[app.job.employmentType as keyof typeof EMPLOYMENT_LABEL] ?? app.job.employmentType}</span>
          </p>
        </div>
        <StageBadge stage={app.stage} />
      </div>

      <ol className="mt-5 grid grid-cols-6 gap-1" aria-label="Application stages">
        {STEPS.map((s, i) => {
          const done = !terminal && i < current;
          const now = !terminal && i === current;
          return (
            <li key={s.stage} className="grid gap-1.5" aria-current={now ? "step" : undefined}>
              <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-2">
                <motion.div
                  className={cn("absolute inset-y-0 left-0 rounded-full", now && s.stage === "hired" ? "bg-lime" : now ? "bg-violet" : "bg-lime")}
                  initial={{ width: 0 }}
                  animate={{ width: done || now ? "100%" : "0%" }}
                  transition={{ ...springs.gentle, delay: 0.05 * i }}
                />
              </div>
              <span
                className={cn(
                  "hidden truncate text-[11px] sm:block",
                  now ? "font-semibold text-ink" : done ? "text-verified" : "text-subtle",
                )}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-xs text-muted sm:hidden">
        {terminal ? (app.stage === "rejected" ? "Not selected" : "Withdrawn") : `Stage ${current + 1} of 6: ${STEPS[current]?.label}`}
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs text-muted">
        <span>
          Applied {formatDate(app.appliedAt)}
          {app.updatedAt !== app.appliedAt && ` · updated ${timeAgo(app.updatedAt)}`}
        </span>
        {WITHDRAWABLE.has(app.stage) && (
          <Button variant="ghost" size="sm" onClick={onWithdraw}>
            <Undo2 aria-hidden />
            Withdraw
          </Button>
        )}
      </div>
    </article>
  );
}

function StageBadge({ stage }: { stage: TrackedApplication["stage"] }) {
  if (stage === "hired")
    return (
      <Badge variant="verified">
        Hired
      </Badge>
    );
  if (stage === "offer") return <Badge variant="verified">Offer</Badge>;
  if (stage === "rejected")
    return (
      <Badge variant="coral">
        <XCircle aria-hidden />
        Not selected
      </Badge>
    );
  if (stage === "withdrawn")
    return (
      <Badge>
        <CircleSlash aria-hidden />
        Withdrawn
      </Badge>
    );
  const label = STEPS.find((s) => s.stage === stage)?.label ?? stage;
  return (
    <Badge variant="violet">
      <Check aria-hidden />
      {label}
    </Badge>
  );
}

function WithdrawDialog({ app, onClose }: { app: TrackedApplication | null; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const confirm = () =>
    start(async () => {
      if (!app) return;
      const res = await withdrawApplication({ applicationId: app.id });
      if (!res.ok) {
        toast.error(res.errors.form ?? "Could not withdraw.");
        return;
      }
      toast.success("Application withdrawn", { description: "You can re-apply from the jobs board while it is open." });
      onClose();
      router.refresh();
    });
  return (
    <Dialog open={!!app} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        {app && (
          <div className="grid gap-4">
            <div>
              <DialogTitle>Withdraw this application?</DialogTitle>
              <DialogDescription className="mt-1.5">
                {app.company.name} will see that you withdrew from <span className="font-medium text-ink">{app.job.title}</span>.
              </DialogDescription>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <DialogClose asChild>
                <Button variant="secondary">Keep it</Button>
              </DialogClose>
              <Button variant="danger" onClick={confirm} loading={pending}>
                Withdraw
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
