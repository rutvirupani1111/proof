/** Deletes the local PGlite database. Refuses to touch a remote DATABASE_URL. */
import { rmSync } from "node:fs";
import { PGLITE_DIR, usingPglite } from "../src/db";

if (!usingPglite()) {
  console.error("db:reset only resets the local PGlite database. Unset DATABASE_URL first.");
  process.exit(1);
}
rmSync(PGLITE_DIR, { recursive: true, force: true });
console.log(`Removed ${PGLITE_DIR}`);
