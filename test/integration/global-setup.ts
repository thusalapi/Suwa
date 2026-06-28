import postgres from "postgres";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Integration-test database lifecycle. Creates a throwaway `suwa_test` database from every
 * Liquibase changeset DDL in order (the `--` lines are comment directives Postgres ignores),
 * runs every integration test against it, then drops it. Fully isolated from the dev `suwa` DB.
 *
 * Connects over TCP (Docker publishes 5432), so no host-side pg client tools are needed.
 */
const ADMIN_URL = "postgresql://suwa:suwa@localhost:5432/postgres";
const TEST_DB = "suwa_test";

const changesDir = fileURLToPath(new URL("../../liquibase/changelog/changes", import.meta.url));

/** Apply every `changes/*.sql` changeset in filename order, stripping `--` comment lines. */
function ddlStatements(): string[] {
  const files = readdirSync(changesDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const sql = files
    .map((f) =>
      readFileSync(`${changesDir}/${f}`, "utf8")
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n"),
    )
    .join("\n");
  return sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function dropTestDb(admin: postgres.Sql): Promise<void> {
  // Terminate any lingering sessions (e.g. the app pool) so DROP DATABASE can proceed.
  await admin.unsafe(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
       WHERE datname = '${TEST_DB}' AND pid <> pg_backend_pid()`,
  );
  await admin.unsafe(`DROP DATABASE IF EXISTS ${TEST_DB}`);
}

export default async function setup() {
  const admin = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });
  await dropTestDb(admin);
  await admin.unsafe(`CREATE DATABASE ${TEST_DB} OWNER suwa`);
  await admin.end();

  const test = postgres(`postgresql://suwa:suwa@localhost:5432/${TEST_DB}`, { max: 1, onnotice: () => {} });
  try {
    for (const stmt of ddlStatements()) await test.unsafe(stmt);
  } finally {
    await test.end();
  }

  // teardown
  return async () => {
    const admin2 = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });
    try {
      await dropTestDb(admin2);
    } finally {
      await admin2.end();
    }
  };
}
