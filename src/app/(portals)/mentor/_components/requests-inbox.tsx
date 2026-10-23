"use client";

import { Inbox, PenLine, ShieldCheck, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { springs } from "@/components/motion/transitions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Textarea } from "@/components/ui/input";
import { SealGlyph } from "@/components/ui/seal-glyph";
import { toast } from "@/components/ui/toast";
import { cn, timeAgo } from "@/lib/utils";
import { STATEMENT_MAX, STATEMENT_MIN } from "@/lib/validation/mentor";
import { declineRequest, endorseRequest } from "@/server/mentor/actions";
import type { AttestationRow } from "@/server/mentor/queries";
import { SealMoment, type SealMomentData } from "../../student/_components/seal-moment";
import { StudentLine, SubjectChip, subjectLabel } from "./subject";

export function RequestsInbox({ rows, canEndorse, domain }: { rows: AttestationRow[]; canEndorse: boolean; domain: string | null }) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [endorsing, setEndorsing] = useState<AttestationRow | null>(null);
  const [declining, setDeclining] = useState<AttestationRow | null>(null);
  const [moment, setMoment] = useState<SealMomentData | null>(null);
  const visible = useMemo(() => rows.filter((r) => !done.has(r.id)), [rows, done]);
  const markDone = (id: string) => setDone((s) => new Set(s).add(id));

  return (
    <>
      {visible.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Inbox zero"
          description="When a student asks you to vouch for a skill or project, the request lands here with their evidence one click away."
          action={
            <Button asChild variant="secondary">
              <Link href="/mentor/endorsements">Endorse a student directly</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3">
          <AnimatePresence initial={false}>
            {visible.map((row) => (
              <motion.li
                key={row.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
                transition={springs.layout}
              >
                <Card className="p-4 sm:p-5">
                  <StudentLine row={row} />
                  <div className="mt-4 grid gap-2 border-t border-dashed border-line pt-4 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-muted">Asks you to vouch for</span>
                      <SubjectChip row={row} />
                    </div>
                    {row.relationship && (
                      <p className="text-muted">
                        <span className="font-mono text-[11px] tracking-wider text-subtle uppercase">Context</span>{" "}
                        {row.relationship}
                      </p>
                    )}
                    {row.headline && <p className="text-xs text-subtle">{row.headline}</p>}
                  </div>
                  <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-mono text-[11px] text-subtle">Requested {timeAgo(row.requestedAt)}</span>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row">
                      <Button variant="ghost" size="sm" onClick={() => setDeclining(row)}>
                        <X aria-hidden />
                        Decline
                      </Button>
                      {row.handle && (
                        <Button variant="secondary" size="sm" asChild>
                          <Link href={`/u/${row.handle}`} target="_blank">
                            Review evidence
                          </Link>
                        </Button>
                      )}
                      <Button size="sm" onClick={() => setEndorsing(row)} disabled={!canEndorse} title={canEndorse ? undefined : "Verify your domain first"}>
                        <PenLine aria-hidden />
                        Endorse
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <EndorseDialog
        row={endorsing}
        domain={domain}
        onClose={() => setEndorsing(null)}
        onDone={(row, credentialId, studentName, subject) => {
          setEndorsing(null);
          markDone(row.id);
          setMoment({
            title: `Endorsement signed`,
            detail: `${studentName}'s ${subject} work now carries your name, sealed into a verifiable credential.`,
            credentialId,
          });
        }}
      />
      <DeclineDialog
        row={declining}
        onClose={() => setDeclining(null)}
        onDone={(row) => {
          setDeclining(null);
          markDone(row.id);
          toast("Request declined. The student was told kindly.");
        }}
      />
      <SealMoment data={moment} onClose={() => setMoment(null)} />
    </>
  );
}

function EndorseDialog({
  row,
  domain,
  onClose,
  onDone,
}: {
  row: AttestationRow | null;
  domain: string | null;
  onClose: () => void;
  onDone: (row: AttestationRow, credentialId: string, studentName: string, subject: string) => void;
}) {
  const [statement, setStatement] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const first = row?.studentName.split(" ")[0] ?? "";
  const len = statement.trim().length;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!row) return;
    const form = new FormData(e.currentTarget);
    start(async () => {
      const res = await endorseRequest({
        attestationId: row.id,
        statement,
        relationship: String(form.get("relationship") ?? ""),
      });
      if (!res.ok) {
        setErrors(res.errors ?? {});
        if (res.error) toast.error(res.error);
        return;
      }
      setErrors({});
      setStatement("");
      onDone(row, res.credentialId, res.studentName, res.subject);
    });
  }

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent>
        {row && (
          <form onSubmit={submit} noValidate>
            <DialogHeader>
              <DialogTitle>
                Endorse {first}&rsquo;s {subjectLabel(row)} work
              </DialogTitle>
              <DialogDescription>Be specific: what did you see them build, and how do you know it was theirs?</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <Field label="How you know their work" htmlFor="relationship" error={errors.relationship}>
                <Input id="relationship" name="relationship" defaultValue={row.relationship ?? ""} placeholder="Guided their final-year project" aria-invalid={!!errors.relationship} />
              </Field>
              <Field
                label="Your statement"
                htmlFor="statement"
                error={errors.statement}
                hint={`${STATEMENT_MIN}-${STATEMENT_MAX} characters. Shown on their profile and signed into the credential.`}
              >
                <Textarea
                  id="statement"
                  value={statement}
                  onChange={(e) => setStatement(e.target.value)}
                  maxLength={STATEMENT_MAX}
                  rows={5}
                  placeholder={`${first} built the offline sync for our lab's attendance app and walked me through every design decision...`}
                  aria-invalid={!!errors.statement}
                />
              </Field>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="inline-flex items-center gap-1.5 text-muted">
                  <SealGlyph className="size-3.5 text-verified" />
                  Signed as {domain ? `Verified mentor at @${domain}` : "you"}
                </span>
                <span className={cn("font-mono tabular", len < STATEMENT_MIN ? "text-subtle" : "text-verified")}>
                  {len}/{STATEMENT_MAX}
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                <motion.div
                  className={cn("h-full rounded-full", len < STATEMENT_MIN ? "bg-line-strong" : "bg-lime")}
                  animate={{ width: `${Math.min(100, (len / STATEMENT_MIN) * 100)}%` }}
                  transition={springs.snappy}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" loading={pending} disabled={len < STATEMENT_MIN}>
                <ShieldCheck aria-hidden />
                Sign endorsement
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DeclineDialog({ row, onClose, onDone }: { row: AttestationRow | null; onClose: () => void; onDone: (row: AttestationRow) => void }) {
  const [pending, start] = useTransition();
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!row) return;
    const note = String(new FormData(e.currentTarget).get("note") ?? "");
    start(async () => {
      const res = await declineRequest({ attestationId: row.id, note });
      if (!res.ok) return void toast.error(res.error ?? Object.values(res.errors ?? {})[0] ?? "Could not decline.");
      onDone(row);
    });
  }
  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent>
        {row && (
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>Decline {row.studentName.split(" ")[0]}&rsquo;s request?</DialogTitle>
              <DialogDescription>Only endorse work you have seen first-hand. Declining is the honest answer when you have not.</DialogDescription>
            </DialogHeader>
            <Field label="Note to the student" htmlFor="note" hint="Optional, up to 300 characters.">
              <Textarea id="note" name="note" maxLength={300} rows={3} placeholder="I did not supervise this project; Prof. Rao did." />
            </Field>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
                Keep it
              </Button>
              <Button type="submit" variant="danger" loading={pending}>
                Decline request
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
