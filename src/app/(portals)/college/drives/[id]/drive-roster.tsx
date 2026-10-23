"use client";

import { motion } from "motion/react";
import { UserPlus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { springs } from "@/components/motion/transitions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { DRIVE_STATUSES, DRIVE_STUDENT_STATUSES, type DriveStudentStatusId } from "@/lib/validation/college";
import { setDriveStatusAction, syncEligibleAction, updateDriveStudentAction } from "@/server/college/actions";

type Row = {
  studentUserId: string;
  status: DriveStudentStatusId;
  result: string | null;
  name: string;
  image: string | null;
  handle: string;
  branch: string | null;
  graduationYear: number | null;
  proofScore: number;
};

const STATUS_LABEL: Record<DriveStudentStatusId, string> = {
  eligible: "Eligible",
  registered: "Registered",
  shortlisted: "Shortlisted",
  selected: "Selected",
  rejected: "Not selected",
  absent: "Absent",
};
const DRIVE_LABEL = { planned: "Planned", open: "Registrations open", completed: "Completed", cancelled: "Cancelled" } as const;

export function DriveControls({ driveId, status, newlyEligible }: { driveId: string; status: (typeof DRIVE_STATUSES)[number]; newlyEligible: number }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [pending, start] = useTransition();
  return (
    <>
      {newlyEligible > 0 && (
        <Button
          variant="secondary"
          loading={pending}
          onClick={() =>
            start(async () => {
              const res = await syncEligibleAction(driveId);
              if (!res.ok) return void toast.error(res.error);
              toast.success(`${res.data.added} newly eligible student${res.data.added === 1 ? "" : "s"} added and notified`);
              router.refresh();
            })
          }
        >
          <UserPlus /> Add {newlyEligible} newly eligible
        </Button>
      )}
      <Select
        value={value}
        onValueChange={(v) => {
          const next = v as typeof status;
          const prev = value;
          setValue(next);
          start(async () => {
            const res = await setDriveStatusAction({ driveId, status: next });
            if (!res.ok) {
              setValue(prev);
              toast.error(res.error);
            } else toast.success(`Drive marked ${DRIVE_LABEL[next].toLowerCase()}`);
          });
        }}
      >
        <SelectTrigger className="w-52" aria-label="Drive status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DRIVE_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {DRIVE_LABEL[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

export function DriveRoster({ driveId, rows: initial }: { driveId: string; rows: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState<DriveStudentStatusId | "all">("all");
  const [, start] = useTransition();
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);
  const shown = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  const update = (r: Row, status: DriveStudentStatusId, result?: string) => {
    const before = rows;
    setRows((all) => all.map((x) => (x.studentUserId === r.studentUserId ? { ...x, status, result: result ?? x.result } : x)));
    start(async () => {
      const res = await updateDriveStudentAction({ driveId, studentUserId: r.studentUserId, status, result: result ?? r.result ?? undefined });
      if (!res.ok) {
        setRows(before);
        toast.error(res.error);
      }
    });
  };

  if (rows.length === 0) {
    return <EmptyState icon={Users} title="No eligible students yet" description="Nobody in your cohort meets this bar today. As students verify more evidence, use “Add newly eligible”." />;
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by status">
        {(["all", ...DRIVE_STUDENT_STATUSES] as const).map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={filter === s}
            onClick={() => setFilter(s)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              filter === s ? "border-ink bg-ink text-canvas" : "border-line text-muted hover:text-ink",
            )}
          >
            {s === "all" ? "All" : STATUS_LABEL[s]} <span className="font-mono opacity-70">{counts[s] ?? 0}</span>
          </button>
        ))}
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-card">
        {shown.map((r) => (
          <motion.li key={r.studentUserId} layout transition={springs.layout} className="grid gap-3 p-3.5 sm:grid-cols-[minmax(0,1fr)_11rem_12rem] sm:items-center sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={r.name} src={r.image} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{r.name}</p>
                <p className="truncate text-xs text-muted">
                  {r.branch ?? "Branch n/a"}
                  {r.graduationYear ? ` · ’${String(r.graduationYear).slice(2)}` : ""} · <span className="font-mono">score {r.proofScore}</span>
                </p>
              </div>
            </div>
            <Select value={r.status} onValueChange={(v) => update(r, v as DriveStudentStatusId)}>
              <SelectTrigger className={cn("h-9", r.status === "selected" && "border-verified/50 text-verified")} aria-label={`Status for ${r.name}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DRIVE_STUDENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              defaultValue={r.result ?? ""}
              placeholder={r.status === "selected" ? "Offer, e.g. ₹8.5 LPA" : "Result note"}
              aria-label={`Result for ${r.name}`}
              className="h-9"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (r.result ?? "")) update(r, r.status, v);
              }}
            />
          </motion.li>
        ))}
      </ul>
    </>
  );
}
