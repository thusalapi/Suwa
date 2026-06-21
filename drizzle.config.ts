import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit is used for INTROSPECTION / STUDIO only (`drizzle-kit studio`).
 * Migrations are owned by Liquibase (liquibase/changelog) — do NOT run
 * `drizzle-kit generate` / `migrate` / `push`. See liquibase/README.md.
 */
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
