"use client";

import { Copy, Download, KeyRound, Loader2, Lock, Mail, MessageSquare } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { springs } from "@/components/motion/transitions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { unlockCandidateAction } from "@/server/billing/actions";
import { UpgradeSheet } from "./upgrade-sheet";
import { UsageMeter, type UsageView } from "./usage-meter";

/** Candidate contact details: masked until the company spends an unlock on them. */
export function ContactUnlockCard({
  studentUserId,
  firstName,
  unlocked: initialUnlocked,
  email: initialEmail,
  usage: initialUsage,
  mode,
}: {
  studentUserId: string;
  firstName: string;
  unlocked: boolean;
  email: string | null;
  usage: UsageView;
  mode: "stripe" | "demo";
}) {
  const [unlocked, setUnlocked] = useState(initialUnlocked);
  const [email, setEmail] = useState(initialEmail);
  const [usage, setUsage] = useState(initialUsage);
  const [sheet, setSheet] = useState(false);
  const [pending, start] = useTransition();
  const blocked = !usage.metered && usage.used >= usage.allowance;

  const unlock = () =>
    start(async () => {
      const res = await unlockCandidateAction({ studentUserId });
      if (!res.ok) {
        if (res.code === "upgrade_required") return setSheet(true);
        return void toast.error(res.error);
      }
      setEmail(res.data.email);
      setUsage(res.data.usage);
      setUnlocked(true);
      toast.success(res.data.message);
    });

  return (
    <Card className="relative grid gap-4 overflow-hidden p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="size-4 text-muted" aria-hidden /> Contact details
        </p>
        {unlocked && <span className="rounded-full bg-verified-soft px-2 py-0.5 font-mono text-[10.5px] text-verified">Unlocked</span>}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {unlocked && email ? (
          <motion.div key="open" initial={{ opacity: 0, filter: "blur(6px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} transition={springs.gentle} className="grid gap-2.5">
            <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/60 px-3 py-2.5 text-sm">
              <Mail className="size-4 shrink-0 text-muted" aria-hidden />
              <a href={`mailto:${email}`} className="min-w-0 flex-1 truncate hover:underline">
                {email}
              </a>
              <button
                type="button"
                aria-label="Copy email"
                className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface hover:text-ink"
                onClick={() => {
                  void navigator.clipboard?.writeText(email);
                  toast.success("Email copied");
                }}
              >
                <Copy className="size-3.5" />
              </button>
            </div>
            <Button asChild variant="secondary" size="sm">
              <Link href={`/recruiter/messages?with=${studentUserId}`}>
                <MessageSquare /> Message {firstName}
              </Link>
            </Button>
          </motion.div>
        ) : (
          <motion.div key="locked" exit={{ opacity: 0, scale: 0.98 }} className="grid gap-3">
            <div className="relative overflow-hidden rounded-xl border border-dashed border-line-strong px-3 py-2.5 text-sm">
              <span className="select-none blur-[5px]" aria-hidden>
                {firstName.toLowerCase()}.candidate@university.ac.in
              </span>
              <span className="absolute inset-0 grid place-items-center">
                <Lock className="size-4 text-muted" aria-label="Locked" />
              </span>
            </div>
            <UsageMeter usage={usage} compact />
            <Button onClick={unlock} disabled={pending} className="w-full">
              {pending ? <Loader2 className="animate-spin" /> : <KeyRound />}
              {blocked ? "Upgrade to unlock" : `Unlock ${firstName}`}
            </Button>
            <p className="text-center text-[11.5px] text-muted">
              {usage.metered && usage.used >= usage.allowance ? "Beyond your allowance: ₹49 on your next invoice." : "Uses one unlock. Messaging opens too."}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <UpgradeSheet
        open={sheet}
        onOpenChange={setSheet}
        owner="company"
        mode={mode}
        currentPlanId="recruiter_free"
        title="Unlock more candidates"
        reason={`You've used all ${usage.allowance} free unlocks this month. Paid plans include 40 or 150 unlocks per seat, then ₹49 each.`}
      />
    </Card>
  );
}

/** College stats CSV export: a download on College Campus, the upgrade sheet otherwise. */
export function ExportCsvButton({ allowed, mode }: { allowed: boolean; mode: "stripe" | "demo" }) {
  const [sheet, setSheet] = useState(false);
  if (allowed) {
    return (
      <Button variant="secondary" asChild>
        <a href="/college/stats/export" download>
          <Download /> Export CSV
        </a>
      </Button>
    );
  }
  return (
    <>
      <Button variant="secondary" onClick={() => setSheet(true)}>
        <Lock /> Export CSV
      </Button>
      <UpgradeSheet
        open={sheet}
        onOpenChange={setSheet}
        owner="college"
        mode={mode}
        currentPlanId="college_free"
        title="Export placement stats"
        reason="CSV exports for accreditation and reports are part of College Campus."
      />
    </>
  );
}
