/**
 * Production database step, run by `npm run vercel-build` before `next build`:
 *
 *   1. Applies drizzle/ migrations to DATABASE_URL_UNPOOLED || DATABASE_URL (Neon). Safe to repeat.
 *   2. When SEED_DEMO=true and the database has no users yet, seeds the fictional demo showcase
 *      (scripts/seed.ts). A database that already has users is never touched, so redeploys keep
 *      whatever people created on the live site.
 *
 * Plain Node (no tsx) for the migration so it runs before anything is compiled. Non-secret flags
 * come from .env.production (committed); Vercel env vars always win over it.
 *
 * With no database URL: a local `npm run vercel-build` skips this step, a Vercel build fails
 * loudly (the serverless runtime has no writable disk for the PGlite fallback).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function loadEnvFile(file) {
  const full = path.join(root, file);
  if (!existsSync(full)) return;
  for (const raw of readFileSync(full, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function main() {
  loadEnvFile(".env.production");

  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    if (process.env.VERCEL) {
      throw new Error(
        "DATABASE_URL is not set for this Vercel build. Connect the Neon integration (vercel integration add neon) and redeploy.",
      );
    }
    console.log("[db-deploy] No DATABASE_URL: skipping migrations and seed (local build).");
    return;
  }
  // Preview builds (one per pull request) share the production database unless Neon
  // branching is set up, so only production builds may change the schema or seed.
  if (process.env.VERCEL && process.env.VERCEL_ENV !== "production") {
    console.log(`[db-deploy] VERCEL_ENV=${process.env.VERCEL_ENV ?? "unknown"}: skipping migrations and seed (production only).`);
    return;
  }
  if (typeof WebSocket === "undefined") {
    throw new Error("[db-deploy] Node 22+ is required (the Neon driver needs a global WebSocket).");
  }

  const { Pool } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-serverless");
  const { migrate } = await import("drizzle-orm/neon-serverless/migrator");

  const pool = new Pool({ connectionString: url });
  let userCount;
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder: path.join(root, "drizzle") });
    console.log("[db-deploy] Migrations applied.");
    const { rows } = await pool.query('select count(*)::int as n from "users"');
    userCount = rows[0]?.n ?? 0;
  } finally {
    await pool.end();
  }

  if (process.env.SEED_DEMO !== "true") {
    console.log("[db-deploy] SEED_DEMO is not true: not seeding.");
    return;
  }
  if (userCount > 0) {
    console.log(`[db-deploy] Database already has ${userCount} users: not seeding.`);
    return;
  }

  console.log("[db-deploy] Empty database and SEED_DEMO=true: seeding the demo showcase…");
  const result = spawnSync(process.execPath, [path.join(root, "node_modules", "tsx", "dist", "cli.mjs"), "scripts/seed.ts"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, PROOF_SEED_REMOTE: "1" },
  });
  if (result.status !== 0) throw new Error(`[db-deploy] Seed failed (exit ${result.status ?? result.signal}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
