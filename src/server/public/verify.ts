import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { evidence, studentProfiles } from "@/db/schema";
import { verifyCredential, verifyCredentialDocument, type CredentialCheck } from "@/server/credentials";

export type VerifyStatus = "valid" | "tampered" | "revoked" | "expired" | "not_found" | "invalid";

export type VerifyView = {
  status: VerifyStatus;
  reason: string;
  credentialId: string | null;
  claim: { title: string; kind: string; skills: string[] } | null;
  /** `handle` only when the subject's profile is PUBLIC (privacy). */
  subject: { name: string; handle: string | null } | null;
  issuer: { id: string; name: string; keyId: string } | null;
  issuedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  /** The credential document (as issued, or as pasted when checking a document). */
  vc: Record<string, unknown> | null;
  signature: string | null;
  /** Each individual check from the credentials engine (signature, binding, revocation, expiry). */
  checks: CredentialCheck[];
  /** Top-level fields that differ between a pasted document and the issued one. */
  changedFields?: string[];
};

const EMPTY: Omit<VerifyView, "status" | "reason"> = {
  credentialId: null,
  claim: null,
  subject: null,
  issuer: null,
  issuedAt: null,
  expiresAt: null,
  revokedAt: null,
  vc: null,
  signature: null,
  checks: [],
};

/** Stable JSON with sorted keys, so field order never counts as a change. */
function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
}

/** Public credential check for /verify/[id], delegating every cryptographic decision to the engine. */
export async function getVerification(id: string): Promise<VerifyView> {
  const result = await verifyCredential(id);
  const cred = result.credential;
  if (!cred) {
    return { ...EMPTY, credentialId: id, status: "not_found", reason: "Proof never issued a credential with this id. Treat it as forged." };
  }
  const db = await getDb();
  const [ev, profile] = await Promise.all([
    db.query.evidence.findFirst({ where: eq(evidence.id, cred.evidenceId), columns: { title: true, kind: true, skillSlugs: true } }),
    db.query.studentProfiles.findFirst({ where: eq(studentProfiles.userId, cred.subjectUserId), columns: { visibility: true } }),
  ]);
  const vc = cred.vc;
  const issuerRaw = vc.issuer as { id?: string; name?: string } | string | undefined;
  const proof = vc.proof as { proofValue?: string } | undefined;
  const view: Omit<VerifyView, "status" | "reason"> = {
    credentialId: cred.id,
    claim: ev ? { title: ev.title, kind: ev.kind, skills: ev.skillSlugs } : { title: cred.type, kind: cred.type, skills: [] },
    subject: result.subject
      ? { name: result.subject.name, handle: profile?.visibility === "public" ? result.subject.handle : null }
      : null,
    issuer: {
      id: typeof issuerRaw === "string" ? issuerRaw : (issuerRaw?.id ?? "urn:proof:platform"),
      name: typeof issuerRaw === "object" && issuerRaw?.name ? issuerRaw.name : "Proof",
      keyId: cred.keyId,
    },
    issuedAt: cred.issuedAt.toISOString(),
    expiresAt: cred.expiresAt?.toISOString() ?? null,
    revokedAt: cred.revokedAt?.toISOString() ?? null,
    vc,
    signature: proof?.proofValue ?? null,
    checks: result.checks,
  };
  if (result.valid) return { ...view, status: "valid", reason: "Ed25519 signature matches Proof's platform key, and the record is current." };
  if (cred.revokedAt) return { ...view, status: "revoked", reason: "Proof revoked this credential. It no longer vouches for the claim." };
  if (cred.expiresAt && cred.expiresAt.getTime() <= Date.now()) return { ...view, status: "expired", reason: "This credential has passed its expiry date." };
  return { ...view, status: "tampered", reason: result.reason ?? "The signature does not match the document." };
}

/** Pulls the credential id out of a VC `id` such as "urn:uuid:<id>" or a ".../verify/<id>" URL. */
function credentialIdFrom(vcId: unknown): string | null {
  if (typeof vcId !== "string") return null;
  const tail = vcId.split(/[/:#?]/).filter(Boolean).at(-1);
  return tail && /^[\w-]{6,80}$/.test(tail) ? tail : null;
}

/**
 * Checks a pasted credential JSON: the signature over the document itself (pure crypto, no
 * trust in our database), then the record it claims to be (revocation, expiry).
 */
export async function verifyPastedDocument(text: string): Promise<VerifyView> {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    return { ...EMPTY, status: "invalid", reason: "That is not valid JSON." };
  }
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    return { ...EMPTY, status: "invalid", reason: "A credential is a JSON object with an id, an issuer and a proof." };
  }
  const pasted = doc as Record<string, unknown>;
  const sig = await verifyCredentialDocument(pasted);
  const id = credentialIdFrom(pasted.id);
  const record = id ? await getVerification(id) : null;
  const signature = typeof (pasted.proof as { proofValue?: unknown } | undefined)?.proofValue === "string" ? ((pasted.proof as { proofValue: string }).proofValue) : null;

  if (!sig.valid) {
    const issued = record?.vc;
    const changed = issued
      ? [...new Set([...Object.keys(issued), ...Object.keys(pasted)])].filter((k) => stable(issued[k]) !== stable(pasted[k]))
      : undefined;
    return {
      ...(record && record.status !== "not_found" ? record : EMPTY),
      vc: pasted,
      signature,
      status: "tampered",
      changedFields: changed && changed.length ? changed : undefined,
      checks: [{ label: "Ed25519 signature matches the Proof platform key", ok: false }],
      reason:
        changed && changed.length
          ? `The signature does not match: ${changed.join(", ")} differ from what Proof issued.`
          : (sig.reason ?? "The signature does not match this document."),
    };
  }
  if (!record || record.status === "not_found") {
    return {
      ...EMPTY,
      vc: pasted,
      signature,
      status: "not_found",
      checks: [{ label: "Ed25519 signature matches the Proof platform key", ok: true }],
      reason: "The signature is genuine, but Proof no longer holds this credential. Treat it as withdrawn.",
    };
  }
  return record;
}
