import { describe, expect, it } from "vitest";
import {
  ISSUER_ID,
  VC_CONTEXT,
  base58btcDecode,
  base58btcEncode,
  canonicalize,
  generateEd25519Keypair,
  importPrivateKey,
  importPublicKey,
  signCredential,
  verifyCredentialSignature,
  type VerifiableCredential,
} from "./vc";

const unsigned: Omit<VerifiableCredential, "proof"> = {
  "@context": [VC_CONTEXT],
  id: "urn:uuid:11111111-2222-4333-8444-555555555555",
  type: ["VerifiableCredential", "LiveDeploymentCredential"],
  issuer: { id: ISSUER_ID, name: "Proof" },
  validFrom: "2026-10-20T10:00:00.000Z",
  credentialSubject: { id: "urn:proof:user:u1", name: "Ishita Varma", claim: { url: "https://x.example", status: 200 } },
};

async function keys() {
  const pair = await generateEd25519Keypair();
  return {
    kid: pair.kid,
    priv: await importPrivateKey(pair.privateJwk),
    pub: await importPublicKey(pair.publicJwk),
  };
}

describe("canonicalize (JCS)", () => {
  it("sorts keys recursively and drops whitespace", () => {
    expect(canonicalize({ b: 1, a: { d: [2, { z: 1, y: 2 }], c: "x" } })).toBe('{"a":{"c":"x","d":[2,{"y":2,"z":1}]},"b":1}');
  });
  it("is stable regardless of insertion order", () => {
    expect(canonicalize({ x: 1, y: 2 })).toBe(canonicalize({ y: 2, x: 1 }));
  });
  it("omits undefined members", () => {
    expect(canonicalize({ a: undefined, b: null })).toBe('{"b":null}');
  });
});

describe("base58btc", () => {
  it("round-trips bytes including leading zeros", () => {
    const bytes = new Uint8Array([0, 0, 1, 2, 250, 255, 7]);
    expect(base58btcDecode(base58btcEncode(bytes))).toEqual(bytes);
  });
  it("encodes a known vector", () => {
    expect(base58btcEncode(new TextEncoder().encode("hello world"))).toBe("StV1DL6CwTryKyV");
  });
});

describe("eddsa-jcs-2022 credentials", () => {
  it("signs and verifies", async () => {
    const k = await keys();
    const vc = await signCredential(unsigned, k.priv, k.kid);
    expect(vc.proof?.proofValue.startsWith("z")).toBe(true);
    expect(await verifyCredentialSignature(vc, k.pub, k.kid)).toEqual({ valid: true });
  });

  it("detects a tampered claim", async () => {
    const k = await keys();
    const vc = await signCredential(unsigned, k.priv, k.kid);
    const tampered = structuredClone(vc);
    (tampered.credentialSubject.claim as Record<string, unknown>).status = 500;
    const res = await verifyCredentialSignature(tampered, k.pub, k.kid);
    expect(res.valid).toBe(false);
    expect(res.reason).toMatch(/altered/);
  });

  it("detects a tampered proof date", async () => {
    const k = await keys();
    const vc = await signCredential(unsigned, k.priv, k.kid);
    const tampered = { ...vc, proof: { ...vc.proof!, created: "2020-01-01T00:00:00.000Z" } };
    expect((await verifyCredentialSignature(tampered, k.pub, k.kid)).valid).toBe(false);
  });

  it("rejects a credential signed by another key", async () => {
    const a = await keys();
    const b = await keys();
    const vc = await signCredential(unsigned, a.priv, a.kid);
    expect((await verifyCredentialSignature(vc, b.pub, b.kid)).valid).toBe(false);
    // Even when the attacker relabels the verification method:
    const relabeled = { ...vc, proof: { ...vc.proof!, verificationMethod: `${ISSUER_ID}#key-${b.kid}` } };
    expect((await verifyCredentialSignature(relabeled, b.pub, b.kid)).valid).toBe(false);
  });

  it("never throws on garbage", async () => {
    const k = await keys();
    expect((await verifyCredentialSignature(null, k.pub, k.kid)).valid).toBe(false);
    expect((await verifyCredentialSignature({ proof: { type: "DataIntegrityProof", cryptosuite: "eddsa-jcs-2022", proofValue: "z!!" } }, k.pub, k.kid)).valid).toBe(false);
  });
});
