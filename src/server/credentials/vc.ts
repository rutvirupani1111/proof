/**
 * Pure W3C Verifiable Credential helpers: JCS canonicalisation (RFC 8785), base58btc multibase,
 * and the `eddsa-jcs-2022` Data Integrity proof (Ed25519 via WebCrypto).
 *
 * No database, no `server-only`: unit-tested directly and shared by scripts.
 */

export const VC_CONTEXT = "https://www.w3.org/ns/credentials/v2";
export const ISSUER_ID = "urn:proof:platform";
export const CRYPTOSUITE = "eddsa-jcs-2022" as const;

export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

export type DataIntegrityProof = {
  type: "DataIntegrityProof";
  cryptosuite: typeof CRYPTOSUITE;
  created: string;
  verificationMethod: string;
  proofPurpose: "assertionMethod";
  proofValue: string;
};

export type VerifiableCredential = {
  "@context": string[];
  id: string;
  type: string[];
  issuer: { id: string; name: string };
  validFrom: string;
  validUntil?: string;
  credentialSubject: Record<string, JsonValue>;
  proof?: DataIntegrityProof;
};

/** RFC 8785 JSON Canonicalization: sorted keys, no whitespace, ES number serialisation. */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Non-finite number");
    if (value === undefined) return "null";
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((v) => canonicalize(v === undefined ? null : v)).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(",")}}`;
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58btcEncode(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const digits: number[] = [];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i]!;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j]! << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  return "1".repeat(zeros) + digits.reverse().map((d) => B58[d]).join("");
}

export function base58btcDecode(text: string): Uint8Array<ArrayBuffer> {
  let zeros = 0;
  while (zeros < text.length && text[zeros] === "1") zeros++;
  const bytes: number[] = [];
  for (let i = zeros; i < text.length; i++) {
    const value = B58.indexOf(text[i]!);
    if (value < 0) throw new Error("Invalid base58 character");
    let carry = value;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j]! * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  return new Uint8Array([...new Array<number>(zeros).fill(0), ...bytes.reverse()]);
}

const enc = new TextEncoder();

async function sha256(text: string): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(text)));
}

/** eddsa-jcs-2022 hashData = sha256(JCS(proofConfig)) || sha256(JCS(document)). */
async function hashData(doc: Omit<VerifiableCredential, "proof">, proofConfig: Record<string, unknown>) {
  const [a, b] = await Promise.all([sha256(canonicalize(proofConfig)), sha256(canonicalize(doc))]);
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

export async function generateEd25519Keypair(): Promise<{ publicJwk: JsonWebKey; privateJwk: JsonWebKey; kid: string }> {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const [publicJwk, privateJwk] = await Promise.all([
    crypto.subtle.exportKey("jwk", pair.publicKey),
    crypto.subtle.exportKey("jwk", pair.privateKey),
  ]);
  return { publicJwk, privateJwk, kid: await keyIdFor(publicJwk) };
}

/** Short stable id for a public key: base64url(sha256(x)) truncated. */
export async function keyIdFor(publicJwk: JsonWebKey): Promise<string> {
  const digest = await sha256(publicJwk.x ?? "");
  return Buffer.from(digest).toString("base64url").slice(0, 16);
}

export function importPrivateKey(jwk: JsonWebKey) {
  return crypto.subtle.importKey("jwk", jwk, { name: "Ed25519" }, false, ["sign"]);
}

export function importPublicKey(jwk: JsonWebKey) {
  const { x, kty, crv } = jwk;
  return crypto.subtle.importKey("jwk", { x, kty, crv }, { name: "Ed25519" }, false, ["verify"]);
}

export function verificationMethodFor(kid: string) {
  return `${ISSUER_ID}#key-${kid}`;
}

/** Signs an unsigned credential and returns it with an attached eddsa-jcs-2022 proof. */
export async function signCredential(
  unsigned: Omit<VerifiableCredential, "proof">,
  privateKey: CryptoKey,
  kid: string,
  created = new Date(),
): Promise<VerifiableCredential> {
  const proofConfig = {
    "@context": unsigned["@context"],
    type: "DataIntegrityProof" as const,
    cryptosuite: CRYPTOSUITE,
    created: created.toISOString(),
    verificationMethod: verificationMethodFor(kid),
    proofPurpose: "assertionMethod" as const,
  };
  const data = await hashData(unsigned, proofConfig);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, privateKey, data));
  const { "@context": _ctx, ...proofFields } = proofConfig;
  void _ctx;
  return { ...unsigned, proof: { ...proofFields, proofValue: `z${base58btcEncode(sig)}` } };
}

export type SignatureCheck = { valid: boolean; reason?: string };

/** Verifies the Data Integrity proof against a known public key. Never throws. */
export async function verifyCredentialSignature(
  vc: unknown,
  publicKey: CryptoKey,
  kid: string,
): Promise<SignatureCheck> {
  try {
    if (!vc || typeof vc !== "object") return { valid: false, reason: "Not a credential document." };
    const { proof, ...doc } = vc as VerifiableCredential;
    if (!proof || proof.type !== "DataIntegrityProof" || proof.cryptosuite !== CRYPTOSUITE) {
      return { valid: false, reason: "Missing or unsupported proof." };
    }
    if (proof.verificationMethod !== verificationMethodFor(kid)) {
      return { valid: false, reason: "Signed by an unknown key." };
    }
    if (!Array.isArray(doc["@context"]) || doc["@context"][0] !== VC_CONTEXT) {
      return { valid: false, reason: "Not a W3C VC v2 document." };
    }
    if (typeof proof.proofValue !== "string" || !proof.proofValue.startsWith("z")) {
      return { valid: false, reason: "Malformed signature." };
    }
    const { proofValue, ...rest } = proof;
    const data = await hashData(doc, { ...rest, "@context": doc["@context"] });
    const sig = base58btcDecode(proofValue.slice(1));
    const ok = await crypto.subtle.verify({ name: "Ed25519" }, publicKey, sig, data);
    return ok ? { valid: true } : { valid: false, reason: "Signature does not match: the credential was altered." };
  } catch {
    return { valid: false, reason: "Signature could not be checked." };
  }
}
