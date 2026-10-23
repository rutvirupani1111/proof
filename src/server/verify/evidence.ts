/**
 * The one way verified work becomes evidence: upsert the evidence row for (kind, sourceId),
 * sign its credential, recompute the student's Proof Score, and notify them.
 *
 * Call only after the caller has authorised the action and verified the facts.
 */
import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { evidence, notifications, type Evidence, type EvidenceKind } from "@/db/schema";
import { issueCredential, revokeCredentialForEvidence } from "@/server/credentials";
import { recomputeProofScore, type ScoreResult } from "@/server/scoring";

export type RecordEvidenceInput = {
  userId: string;
  kind: EvidenceKind;
  sourceId: string;
  title: string;
  summary?: string | null;
  skillSlugs: string[];
  data: Record<string, unknown>;
  weight?: number;
  occurredAt?: Date | null;
  /** Notification copy; omit to stay quiet (e.g. bulk backfills). */
  notify?: { title: string; body?: string; href?: string };
};

export type RecordEvidenceResult = {
  evidence: Evidence;
  credentialId: string;
  score: ScoreResult;
  /** Score before this evidence, for the "+6" moment in the UI. */
  previousScore: number;
};

export async function recordVerifiedEvidence(input: RecordEvidenceInput): Promise<RecordEvidenceResult> {
  const db = await getDb();
  const before = await db.query.studentProfiles.findFirst({
    where: (p, { eq: e }) => e(p.userId, input.userId),
    columns: { proofScore: true },
  });
  const now = new Date();
  const values = {
    userId: input.userId,
    kind: input.kind,
    sourceId: input.sourceId,
    title: input.title,
    summary: input.summary ?? null,
    skillSlugs: input.skillSlugs,
    data: input.data,
    weight: input.weight ?? 1,
    status: "verified" as const,
    verifiedAt: now,
    occurredAt: input.occurredAt ?? now,
  };
  const [row] = await db
    .insert(evidence)
    .values(values)
    .onConflictDoUpdate({ target: [evidence.kind, evidence.sourceId], set: values })
    .returning();
  const ev = row!;
  const credential = await issueCredential({
    userId: input.userId,
    type: input.kind,
    evidenceId: ev.id,
    claim: { title: input.title, ...(input.summary ? { summary: input.summary } : {}), skills: input.skillSlugs, ...input.data },
  });
  const score = await recomputeProofScore(input.userId);
  if (input.notify) {
    await db.insert(notifications).values({
      userId: input.userId,
      type: "evidence.verified",
      title: input.notify.title,
      body: input.notify.body ?? null,
      href: input.notify.href ?? "/student/proofs",
    });
  }
  return { evidence: ev, credentialId: credential.id, score, previousScore: before?.proofScore ?? 0 };
}

/** Evidence no longer holds (attestation revoked, deployment gone): mark it, revoke the VC, rescore. */
export async function revokeEvidence(userId: string, kind: EvidenceKind, sourceId: string) {
  const db = await getDb();
  const [row] = await db
    .update(evidence)
    .set({ status: "revoked" })
    .where(and(eq(evidence.userId, userId), eq(evidence.kind, kind), eq(evidence.sourceId, sourceId)))
    .returning({ id: evidence.id });
  if (row) await revokeCredentialForEvidence(row.id);
  return recomputeProofScore(userId);
}
