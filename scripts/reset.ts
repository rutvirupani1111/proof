/** Deletes the local PGlite database. Refuses to touch a remote DATABASE_URL. */
import { readFileSync, rmSync } from "node:fs";
import { PGLITE_DIR, PGLITE_LOCK, usingPglite } from "../src/db";

if (!usingPglite()) {
  console.error("db:reset only resets the local PGlite database. Unset DATABASE_URL first.");
  process.exit(1);
}
let holder = NaN;
try {
  holder = Number.parseInt(readFileSync(PGLITE_LOCK, "utf8").trim(), 10);
} catch {
  /* no lock */
}
if (Number.isInteger(holder)) {
  let alive = false;
  try {
    process.kill(holder, 0);
    alive = true;
  } catch (err) {
    alive = (err as NodeJS.ErrnoException).code === "EPERM";
  }
  if (alive) {
    console.error(`.data/pglite is in use by pid ${holder}. Stop the dev server or script first.`);
    process.exit(1);
  }
}
rmSync(PGLITE_DIR, { recursive: true, force: true });
rmSync(PGLITE_LOCK, { force: true });
console.log(`Removed ${PGLITE_DIR}`);
