import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Unit tests for the engines (credentials, scoring, verification, sandbox). They are pure or
 * take their inputs as arguments; nothing here needs the database.
 * `server-only` resolves to its empty build so server modules can be imported in tests.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "node_modules/server-only/empty.js"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    testTimeout: 20_000,
  },
});
