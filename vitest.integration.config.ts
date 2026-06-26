import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Integration tests — exercise the server-only DB modules (bills, payments, dashboard,
 * revenue) against a throwaway `suwa_test` Postgres database (see test/integration/global-
 * setup.ts). Needs the Docker DB up on localhost:5432. Run with `npm run test:integration`.
 *
 * fileParallelism is off because every test shares the one database and resets it between tests.
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
    include: ["test/integration/**/*.test.ts"],
    globalSetup: ["test/integration/global-setup.ts"],
    env: { DATABASE_URL: "postgresql://suwa:suwa@localhost:5432/suwa_test" },
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
