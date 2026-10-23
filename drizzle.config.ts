import { defineConfig } from "drizzle-kit";

// `npm run db:generate` only needs the schema. Studio connects to Neon when
// DATABASE_URL is set, otherwise to the local PGlite directory.
const url = process.env.DATABASE_URL;

export default url
  ? defineConfig({
      dialect: "postgresql",
      schema: "./src/db/schema.ts",
      out: "./drizzle",
      dbCredentials: { url },
      strict: true,
    })
  : defineConfig({
      dialect: "postgresql",
      driver: "pglite",
      schema: "./src/db/schema.ts",
      out: "./drizzle",
      dbCredentials: { url: "./.data/pglite" },
      strict: true,
    });
