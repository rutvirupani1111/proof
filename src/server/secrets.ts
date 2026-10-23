/**
 * Generated-once platform secrets persisted in `app_secrets`, so nobody types secrets into
 * Vercel. First caller generates; concurrent callers converge on the stored row.
 *
 * No `server-only` import so scripts can use it; never import from client code.
 */
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { appSecrets } from "@/db/schema";

export const SECRET_KEYS = {
  authSecret: "better_auth_secret",
  /** Reserved for the credential engine: JSON { publicJwk, privateJwk, kid } (Ed25519). */
  credentialKeypair: "credential_ed25519_keypair",
} as const;

export async function getOrCreateSecret(key: string, generate: () => string | Promise<string>) {
  const db = await getDb();
  const existing = await db.query.appSecrets.findFirst({ where: eq(appSecrets.key, key) });
  if (existing) return existing.value;

  await db
    .insert(appSecrets)
    .values({ key, value: await generate() })
    .onConflictDoNothing({ target: appSecrets.key });
  const stored = await db.query.appSecrets.findFirst({ where: eq(appSecrets.key, key) });
  if (!stored) throw new Error(`Failed to persist secret ${key}`);
  return stored.value;
}

/** BETTER_AUTH_SECRET when provided, otherwise a 64-byte secret generated once and stored. */
export async function getAuthSecret(): Promise<string> {
  const fromEnv = process.env.BETTER_AUTH_SECRET;
  if (fromEnv && fromEnv.length >= 32) return fromEnv;
  return getOrCreateSecret(SECRET_KEYS.authSecret, () => randomBytes(64).toString("base64url"));
}
