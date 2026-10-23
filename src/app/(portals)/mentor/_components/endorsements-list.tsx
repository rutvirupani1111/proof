"use client";

import { Award, ExternalLink, Undo2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { springs } from "@/components/motion/transitions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/toast";
import { cn, timeAgo } from "@/lib/utils";
import { revokeEndorsement } from "@/server/mentor/actions";
import type { AttestationRow } from "@/server/mentor/queries";
import { StudentLine, SubjectChip } from "./subject";

export function EndorsementsList({ rows }: { rows: AttestationRow[] }) {
  const [revoked, setRevoked] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<AttestationRow | null>(null);
  const [pending, start] = useTransition();

  function revoke() {
    const row = confirming;
    if (!row) return;
    start(async () => {
      const res = await revokeEndorsement({ attestationId: row.id });
      if (!res.ok) return void toast.error(res.error ?? "Could not revoke.");
      setRevoked((s) => new Set(s).add(row.id));
      setConfirming(null);
      toast("Endorsement revoked. Its credential now verifies as revoked.");
    });
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Award}
        title="No endorsements yet"
        description="Endorse a request from your inbox, or vouch for a student directly with the form alongside."
      />
    );
  }

  return (
    <>
      <ul className="grid gap-3">
        <AnimatePresence initial={false}>
          {rows.map((row) => {
            const isRevoked = row.status === "revoked" || revoked.has(row.id);
            return (
              <motion.li key={row.id} layout transition={springs.layout}>
                <Card variant={isRevoked ? "flat" : "default"} className={cn("p-4 transition-opacity sm:p-5", isRevoked && "opacity-75")}>
                  <StudentLine row={row} />
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <SubjectChip row={row} />
                    {isRevoked ? <Badge variant="coral">Revoked</Badge> : <Badge variant="verified">Signed credential</Badge>}
                  </div>
                  {row.statement && (
                    <blockquote className="mt-3 border-l-2 border-lime pl-3 text-sm leading-relaxed text-pretty text-ink">
                      &ldquo;{row.statement}&rdquo;
                    </blockquote>
                  )}
                  {row.relationship && <p className="mt-2 text-xs text-muted">{row.relationship}</p>}
                  <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-mono text-[11px] text-subtle">
                      {isRevoked ? "Revoked" : "Endorsed"} {timeAgo(row.respondedAt)}
                    </span>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row">
                      {!isRevoked && (
                        <Button variant="ghost" size="sm" onClick={() => setConfirming(row)}>
                          <Undo2 aria-hidden />
                          Revoke
                        </Button>
                      )}
                      {row.credentialId && (
                        <Button variant="secondary" size="sm" asChild>
                          <Link href={`/verify/${row.credentialId}`} target="_blank">
                            <ExternalLink aria-hidden />
                            Credential
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      <Dialog open={!!confirming} onOpenChange={(o) => !o && !pending && setConfirming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke this endorsement?</DialogTitle>
            <DialogDescription>
              The credential will verify as revoked, it stops counting toward {confirming?.studentName.split(" ")[0]}&rsquo;s
              Proof Score, and they are notified. This cannot be undone; you can endorse again later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(null)} disabled={pending}>
              Keep endorsement
            </Button>
            <Button variant="danger" onClick={revoke} loading={pending}>
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
