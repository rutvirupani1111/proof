/**
 * The one way to reach the database: `const db = await getDb()`.
 *
 * - DATABASE_URL set   -> Neon serverless Postgres (production, previews).
 * - DATABASE_URL unset -> PGlite, an in-process Postgres persisted under .data/pglite (local dev,
 *   tests, scripts). PGlite is single-process: stop `next dev`/`next start` before running
 *   `npm run db:seed` or `npm run db:migrate` against the same directory. One instance per
 *   process (cached on globalThis so HMR and route bundles share it) and a pid lock file
 *   (.data/pglite.lock) across processes; a corrupt data dir fails with a pointer to db:reset.
 *
 * Both drivers expose the same Drizzle query builder; `Db` is typed as the PGlite flavour and the
 * Neon instance is cast to it. Avoid `db.execute()` result shapes (they differ per driver); use
 * the query builder or `db.query.*`.
 *
 * Deliberately no `import "server-only"` here so tsx scripts can import it. Never import this
 * module from a client component; go through src/server/*.
 */
import { mkdirSync, openSync, readFileSync, unlinkSync, writeSync, closeSync } from "node:fs";
import path from "node:path";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "./schema";

export type Db = PgliteDatabase<typeof schema>;
export { schema };

export const PGLITE_DIR = path.join(process.cwd(), ".data", "pglite");
export const PGLITE_LOCK = path.join(process.cwd(), ".data", "pglite.lock");
export const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

/** Thrown when .data/pglite is held by another process or cannot be opened. */
export class PgliteUnavailableError extends Error {
  override name = "PgliteUnavailableError";
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * PGlite has no cross-process locking: two processes on one data dir (e.g. `next start` plus
 * `npm run db:seed`, or a second dev server) write the same WAL and the cluster ends up
 * unreadable, which surfaces later as an opaque `RuntimeError: Aborted()`. Take an exclusive
 * pid lock file next to the data dir so the second process fails fast with a clear message.
 */
function acquirePgliteLock(): () => void {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(PGLITE_LOCK, "wx");
      writeSync(fd, String(process.pid));
      closeSync(fd);
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        process.off("exit", release);
        try {
          if (readFileSync(PGLITE_LOCK, "utf8").trim() === String(process.pid)) unlinkSync(PGLITE_LOCK);
        } catch {
          /* already gone */
        }
      };
      process.on("exit", release);
      return release;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      const holder = Number.parseInt(readFileSync(PGLITE_LOCK, "utf8").trim(), 10);
      if (Number.isInteger(holder) && holder !== process.pid && pidAlive(holder)) {
        throw new PgliteUnavailableError(
          `The local database (.data/pglite) is in use by another process (pid ${holder}). ` +
            "PGlite is single-process: stop that dev server, `next start` or script and try again.",
        );
      }
      // Stale lock from a crashed or killed process: take it over.
      unlinkSync(PGLITE_LOCK);
    }
  }
  throw new PgliteUnavailableError(`Could not acquire ${PGLITE_LOCK}.`);
}

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
  const release = acquirePgliteLock();
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  let client: InstanceType<typeof PGlite>;
  try {
    client = new PGlite(PGLITE_DIR);
    await client.waitReady;
  } catch (err) {
    release();
    throw new PgliteUnavailableError(
      "The local database (.data/pglite) could not be opened; it is most likely corrupted by an " +
        "unclean shutdown or by two processes using it at once. Run `npm run db:reset` to recreate, " +
        `migrate and seed it. (${err instanceof Error ? err.message : String(err)})`,
      { cause: err },
    );
  }
  state.close = async () => {
    try {
      await client.close();
    } finally {
      release();
    }
  };
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
