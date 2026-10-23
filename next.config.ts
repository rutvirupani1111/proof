import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships WASM + data files that must be loaded from node_modules at runtime,
  // and the Neon driver opens WebSockets; neither should be bundled by the server compiler.
  serverExternalPackages: ["@electric-sql/pglite", "@neondatabase/serverless"],
  poweredByHeader: false,
  typedRoutes: false,
};

export default nextConfig;
