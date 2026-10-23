/**
 * The one way to reach the database: `const db = await getDb()`.
 *
 * - DATABASE_URL set   -> Neon serverless Postgres (production, previews).
 * - DATABASE_URL unset -> PGlite, an in-process Postgres persisted under .data/pglite (local dev,
 *   tests, scripts). PGlite is single-process: stop `next dev`/`next start` before running
 *   `npm run db:seed` or `npm run db:migrate` against the same directory.
 *
 * Both drivers expose the same Drizzle query builder; `Db` is typed as the PGlite flavour and the
 * Neon instance is cast to it. Avoid `db.execute()` result shapes (they differ per driver); use
 * the query builder or `db.query.*`.
 *
 * Deliberately no `import "server-only"` here so tsx scripts can import it. Never import this
 * module from a client component; go through src/server/*.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "./schema";

export type Db = PgliteDatabase<typeof schema>;
export { schema };

export const PGLITE_DIR = path.join(process.cwd(), ".data", "pglite");
export const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

type DbState = { promise?: Promise<Db>; close?: () => Promise<void> };
const globalForDb = globalThis as unknown as { __proofDb?: DbState };
const state: DbState = (globalForDb.__proofDb ??= {});

export function usingPglite(): boolean {
  return !process.env.DATABASE_URL;
}

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-serverless");
    const pool = new Pool({ connectionString: url });
    state.close = () => pool.end();
    return drizzle({ client: pool, schema }) as unknown as Db;
  }

  mkdirSync(PGLITE_DIR, { recursive: true });
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const client = new PGlite(PGLITE_DIR);
  await client.waitReady;
  state.close = () => client.close();
  const db = drizzle({ client, schema });

  // Local convenience: keep the PGlite database on the latest migration automatically.
  // Production (Neon) is migrated explicitly by `npm run db:migrate` in the build step.
  if (process.env.PROOF_AUTO_MIGRATE !== "0") {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  }
  return db;
}

export function getDb(): Promise<Db> {
  state.promise ??= connect().catch((err) => {
    state.promise = undefined;
    throw err;
  });
  return state.promise;
}

/** For scripts: release the connection so the process can exit. */
export async function closeDb(): Promise<void> {
  await state.close?.();
  state.promise = undefined;
  state.close = undefined;
}
