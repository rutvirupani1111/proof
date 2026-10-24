// Playwright config for the CI smoke test (.github/workflows/ci.yml, job "smoke").
//
// It starts the already-built app with `next start` on port 5191 (the test port), backed by the
// local PGlite database that the workflow has just migrated and seeded, then runs smoke.spec.mjs.
//
// Run it yourself after `npm run build && npm run db:migrate && npm run db:seed`:
//   npx playwright test --config .github/e2e/playwright.config.mjs
//
// Point it at a server that is already running instead (no webServer is started):
//   PROOF_BASE_URL=http://localhost:5190 npx playwright test --config .github/e2e/playwright.config.mjs
//
// The file is .mjs on purpose: it stays out of `npm run typecheck` (allowJs is off).
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const externalBaseURL = process.env.PROOF_BASE_URL;
const port = 5191;

export default defineConfig({
  testDir: here,
  outputDir: path.join(root, "test-results"),
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["list"], ["github"], ["html", { outputFolder: path.join(root, "playwright-report"), open: "never" }]]
    : [["list"], ["html", { outputFolder: path.join(root, "playwright-report"), open: "never" }]],
  use: {
    baseURL: externalBaseURL ?? `http://localhost:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: externalBaseURL
    ? undefined
    : {
        command: `npx next start -p ${port}`,
        cwd: root,
        url: `http://localhost:${port}/login`,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
        stdout: "pipe",
        stderr: "pipe",
      },
});
