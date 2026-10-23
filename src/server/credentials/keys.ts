/**
 * The platform Ed25519 keypair, generated once and stored in app_secrets
 * (SECRET_KEYS.credentialKeypair). Nobody types it into Vercel.
 *
 * No `server-only`: the seed script issues credentials. Never import from client code.
 */
import { getOrCreateSecret, SECRET_KEYS } from "@/server/secrets";
import { generateEd25519Keypair, importPrivateKey, importPublicKey } from "./vc";

type StoredKeypair = { publicJwk: JsonWebKey; privateJwk: JsonWebKey; kid: string };
export type PlatformKeys = { kid: string; publicJwk: JsonWebKey; privateKey: CryptoKey; publicKey: CryptoKey };

const g = globalThis as unknown as { __proofKeys?: Promise<PlatformKeys> };

export function getPlatformKeys(): Promise<PlatformKeys> {
  g.__proofKeys ??= (async () => {
    const raw = await getOrCreateSecret(SECRET_KEYS.credentialKeypair, async () =>
      JSON.stringify(await generateEd25519Keypair()),
    );
    const stored = JSON.parse(raw) as StoredKeypair;
    const [privateKey, publicKey] = await Promise.all([
      importPrivateKey(stored.privateJwk),
      importPublicKey(stored.publicJwk),
    ]);
    return { kid: stored.kid, publicJwk: { kty: "OKP", crv: "Ed25519", x: stored.publicJwk.x }, privateKey, publicKey };
  })().catch((err) => {
    g.__proofKeys = undefined;
    throw err;
  });
  return g.__proofKeys;
}

/** For tests and the seed after a wipe: forget the cached key so it is re-read. */
export function resetPlatformKeyCache() {
  g.__proofKeys = undefined;
}
