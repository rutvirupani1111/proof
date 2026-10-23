"use client";

import { CalendarClock, Check, GraduationCap, MapPin, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { registerForDriveAction } from "@/server/student/drive-actions";
import type { StudentDrive } from "@/server/student/drives";
import { formatDate } from "./format";

const ROSTER_LABEL: Record<NonNullable<StudentDrive["rosterStatus"]>, { text: string; variant: "neutral" | "verified" | "violet" | "coral" }> = {
  eligible: { text: "Eligible", variant: "neutral" },
  registered: { text: "Registered", variant: "violet" },
  shortlisted: { text: "Shortlisted", variant: "violet" },
  selected: { text: "Selected", variant: "verified" },
  rejected: { text: "Not selected", variant: "coral" },
  absent: { text: "Marked absent", variant: "coral" },
};

function DriveCard({ drive }: { drive: StudentDrive }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [registered, setRegistered] = useState(false);
  const status = registered ? "registered" : drive.rosterStatus;
  const closed = drive.status === "completed" || drive.status === "cancelled";

  return (
    <Card variant={status === "selected" ? "verified" : "default"} className="flex flex-col">
      <div className="grid flex-1 gap-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted">{drive.companyName}</p>
            <h3 className="font-display text-base font-semibold">{drive.title}</h3>
          </div>
          {status ? (
            <Badge variant={ROSTER_LABEL[status].variant}>{ROSTER_LABEL[status].text}</Badge>
          ) : closed ? (
            <Badge>{drive.status === "completed" ? "Completed" : "Cancelled"}</Badge>
          ) : null}
        </div>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {drive.scheduledAt && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-3.5" aria-hidden /> {formatDate(drive.scheduledAt)}
            </span>
          )}
          {drive.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden /> {drive.location}
            </span>
          )}
        </p>
        {drive.criteria.length > 0 ? (
          <ul className="grid gap-1 text-xs" aria-label="Eligibility">
            {drive.criteria.map((c) => (
              <li key={c.label} className={cn("flex items-center gap-1.5", c.met ? "text-verified" : "text-coral-text")}>
                {c.met ? <Check className="size-3.5 shrink-0" aria-hidden /> : <X className="size-3.5 shrink-0" aria-hidden />}
                <span>{c.label}</span>
                <span className="sr-only">{c.met ? "(met)" : "(not met)"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted">Open to every student of your college.</p>
        )}
        {drive.result && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
            <span className="font-medium">Result:</span> {drive.result}
          </p>
        )}
      </div>
      {!closed && (!status || status === "eligible") && (
        <div className="border-t border-line p-4 sm:px-5">
          {drive.canRegister ? (
            <Button
              className="w-full sm:w-auto"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await registerForDriveAction({ driveId: drive.id });
                  if (res.ok) {
                    setRegistered(true);
                    toast.success(`Registered for ${drive.companyName}`, { description: "Your placement cell can see you on the roster." });
                    router.refresh();
                  } else toast.error(res.error);
                })
              }
            >
              {pending ? "Registering…" : "Register"}
            </Button>
          ) : (
            <p className="text-xs text-muted">Meet every criterion above with verified evidence to register.</p>
          )}
        </div>
      )}
    </Card>
  );
}

export function DrivesPanel({ drives }: { drives: StudentDrive[] }) {
  return (
    <section id="drives" aria-labelledby="drives-title" className="mb-8 scroll-mt-24">
      <div className="mb-3 flex items-center gap-2">
        <GraduationCap className="size-4 text-violet-text" aria-hidden />
        <h2 id="drives-title" className="font-display text-lg font-semibold">
          College drives
        </h2>
        <span className="text-sm text-muted">· run by your placement cell</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {drives.map((d) => (
          <DriveCard key={d.id} drive={d} />
        ))}
      </div>
    </section>
  );
}
