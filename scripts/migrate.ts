/**
 * Applies drizzle/ migrations to the active database (Neon when DATABASE_URL is set,
 * otherwise PGlite under .data/pglite). Safe to run repeatedly.
 */
import { closeDb, getDb, MIGRATIONS_DIR, usingPglite } from "../src/db";

async function main() {
  process.env.PROOF_AUTO_MIGRATE = "0";
  const db = await getDb();
  if (usingPglite()) {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  } else {
    const { migrate } = await import("drizzle-orm/neon-serverless/migrator");
    // The Neon instance is cast to Db in src/db; the migrator accepts it at runtime.
    await migrate(db as never, { migrationsFolder: MIGRATIONS_DIR });
  }
  console.log(`Migrations applied (${usingPglite() ? "PGlite .data/pglite" : "DATABASE_URL"}).`);
  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb().catch(() => {});
  process.exit(1);
});
