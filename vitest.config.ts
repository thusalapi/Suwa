import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Unit-test config for the pure-logic modules (report engine, schemas, analytics date logic,
 * backup crypto, i18n). Two aliases make those modules importable outside the Next runtime:
 *  - `server-only` → an empty stub (the package throws if imported outside a Server Component).
 *  - `@/*` → `src/*`, mirroring tsconfig paths.
 * A dummy DATABASE_URL lets modules that transitively import the (lazy) postgres client load
 * without a real connection — postgres.js only connects on the first query, which unit tests
 * never make.
 */
export default defineConfig({
  resolve: {
    alias: {
      "server-only": fileURLToPath(new URL("./test/stubs/server-only.ts", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    exclude: ["test/integration/**", "node_modules/**"],
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    },
    coverage: {
      provider: "v8",
      include: ["src/lib/**"],
      reporter: ["text", "html"],
    },
  },
});
