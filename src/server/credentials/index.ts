/**
 * Credentials engine: every verified evidence row becomes a W3C Verifiable Credential signed
 * with the platform Ed25519 key (eddsa-jcs-2022 Data Integrity proof).
 *
 *   const cred = await issueCredential({ userId, type: "deployment", claim: { url }, evidenceId });
 *   const result = await verifyCredential(cred.id); // { valid, credential, subject, issuedAt, reason? }
 *
 * No `server-only`: the seed script backfills credentials. Never import from client code.
 * Callers are responsible for authorisation: issueCredential trusts its arguments, so only call
 * it from server code that has already verified the evidence for the session user.
 */
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { credentials, evidence, studentProfiles, users, type Credential, type EvidenceKind } from "@/db/schema";
import { getPlatformKeys } from "./keys";
import {
  ISSUER_ID,
  VC_CONTEXT,
  signCredential,
  verifyCredentialSignature,
  type JsonValue,
  type VerifiableCredential,
} from "./vc";

export { canonicalize, type VerifiableCredential } from "./vc";

/** VC `type` per evidence kind. */
export const CREDENTIAL_TYPES: Record<EvidenceKind, string> = {
  github_ownership: "GitHubOwnershipCredential",
  repo_authorship: "CodeAuthorshipCredential",
  deployment: "LiveDeploymentCredential",
  skill_check: "SkillCheckCredential",
  attestation: "MentorAttestationCredential",
};

export const CREDENTIAL_LABELS: Record<string, string> = {
  GitHubOwnershipCredential: "GitHub ownership",
  CodeAuthorshipCredential: "Code authorship",
  LiveDeploymentCredential: "Live deployment",
  SkillCheckCredential: "Skill check",
  MentorAttestationCredential: "Mentor attestation",
};

function vcTypeFor(type: string): string {
  return (CREDENTIAL_TYPES as Record<string, string>)[type] ?? type;
}

function toJson(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as JsonValue;
}

export type IssueInput = {
  userId: string;
  /** An evidence kind (e.g. "deployment") or a VC type name. */
  type: EvidenceKind | string;
  /** Facts being attested; becomes part of credentialSubject. */
  claim: Record<string, unknown>;
  evidenceId: string;
};

/**
 * Issues (or returns the existing) signed credential for an evidence row. A revoked credential
 * for the same evidence is re-signed and un-revoked, since the evidence was verified again.
 */
export async function issueCredential({ userId, type, claim, evidenceId }: IssueInput): Promise<Credential> {
  const db = await getDb();
  const existing = await db.query.credentials.findFirst({ where: eq(credentials.evidenceId, evidenceId) });
  if (existing && !existing.revokedAt) return existing;

  const [user, profile, ev] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, userId), columns: { id: true, name: true } }),
    db.query.studentProfiles.findFirst({ where: eq(studentProfiles.userId, userId), columns: { handle: true } }),
    db.query.evidence.findFirst({ where: eq(evidence.id, evidenceId), columns: { id: true, kind: true, userId: true } }),
  ]);
  if (!user) throw new Error("Credential subject not found.");
  if (!ev || ev.userId !== userId) throw new Error("Evidence does not belong to this subject.");

  const keys = await getPlatformKeys();
  const id = existing?.id ?? crypto.randomUUID();
  const vcType = vcTypeFor(type);
  const issuedAt = new Date();
  const unsigned: Omit<VerifiableCredential, "proof"> = {
    "@context": [VC_CONTEXT],
    id: `urn:uuid:${id}`,
    type: ["VerifiableCredential", vcType],
    issuer: { id: ISSUER_ID, name: "Proof" },
    validFrom: issuedAt.toISOString(),
    credentialSubject: {
      id: `urn:proof:user:${userId}`,
      name: user.name,
      ...(profile ? { handle: profile.handle } : {}),
      evidence: { id: evidenceId, kind: ev.kind },
      claim: toJson(claim),
    },
  };
  const vc = await signCredential(unsigned, keys.privateKey, keys.kid, issuedAt);
  const row = {
    id,
    evidenceId,
    subjectUserId: userId,
    type: vcType,
    vc: vc as unknown as Record<string, unknown>,
    keyId: keys.kid,
    issuedAt,
    revokedAt: null,
  };
  if (existing) {
    const [updated] = await db.update(credentials).set(row).where(eq(credentials.id, id)).returning();
    return updated!;
  }
  const [inserted] = await db.insert(credentials).values(row).returning();
  return inserted!;
}

/** Marks the credential for an evidence row revoked (evidence revoked or re-checked and failed). */
export async function revokeCredentialForEvidence(evidenceId: string) {
  const db = await getDb();
  await db.update(credentials).set({ revokedAt: new Date() }).where(eq(credentials.evidenceId, evidenceId));
}

export type CredentialCheck = { label: string; ok: boolean };
export type VerifyResult = {
  valid: boolean;
  credential: Credential | null;
  subject: { userId: string; name: string; handle: string | null } | null;
  issuedAt: Date | null;
  reason?: string;
  /** Each individual check, for the green/red ledger on /verify/[id]. */
  checks: CredentialCheck[];
};

/** Verifies a stored credential by id: signature, identity binding, revocation, expiry. */
export async function verifyCredential(id: string): Promise<VerifyResult> {
  const db = await getDb();
  const credential = /^[0-9a-f-]{36}$/i.test(id)
    ? await db.query.credentials.findFirst({ where: eq(credentials.id, id) })
    : undefined;
  if (!credential) {
    return { valid: false, credential: null, subject: null, issuedAt: null, reason: "No credential with this id.", checks: [] };
  }
  const [user, profile] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, credential.subjectUserId), columns: { id: true, name: true } }),
    db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.userId, credential.subjectUserId),
      columns: { handle: true },
    }),
  ]);
  const subject = user ? { userId: user.id, name: user.name, handle: profile?.handle ?? null } : null;

  const keys = await getPlatformKeys();
  const vc = credential.vc as unknown as VerifiableCredential;
  const sig =
    credential.keyId === keys.kid
      ? await verifyCredentialSignature(vc, keys.publicKey, keys.kid)
      : { valid: false, reason: "Signed by a key this platform no longer holds." };
  const idMatches = vc?.id === `urn:uuid:${credential.id}`;
  const subjectMatches = vc?.credentialSubject?.id === `urn:proof:user:${credential.subjectUserId}`;
  const notRevoked = !credential.revokedAt;
  const notExpired = !credential.expiresAt || credential.expiresAt.getTime() > Date.now();

  const checks: CredentialCheck[] = [
    { label: "Ed25519 signature matches the Proof platform key", ok: sig.valid },
    { label: "Credential id is bound to this record", ok: idMatches },
    { label: "Issued to this person", ok: subjectMatches && !!subject },
    { label: "Not revoked", ok: notRevoked },
    { label: "Not expired", ok: notExpired },
  ];
  const reason = !sig.valid
    ? sig.reason
    : !idMatches
      ? "The credential id was altered."
      : !subjectMatches || !subject
        ? "The subject was altered."
        : !notRevoked
          ? "This credential was revoked."
          : !notExpired
            ? "This credential has expired."
            : undefined;
  return { valid: !reason, credential, subject, issuedAt: credential.issuedAt, reason, checks };
}

/**
 * Verifies a VC document someone pasted or downloaded (no DB lookup of the record): only the
 * signature against the platform key. Use it for "check this JSON" tamper demos.
 */
export async function verifyCredentialDocument(vc: unknown) {
  const keys = await getPlatformKeys();
  return verifyCredentialSignature(vc, keys.publicKey, keys.kid);
}

/** The platform public key as JWK, for publishing alongside credentials. */
export async function getIssuerPublicKey() {
  const keys = await getPlatformKeys();
  return { id: ISSUER_ID, kid: keys.kid, publicKeyJwk: keys.publicJwk };
}
