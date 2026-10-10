/**
 * Apply the Liquibase changesets without Liquibase — for the clinic PC, which then needs only
 * Node + PostgreSQL (no Java, no Liquibase, no JDBC driver).
 *
 *   npm run db:deploy          apply pending changesets
 *   npm run db:deploy -- --status   list them without applying
 *
 * Liquibase stays the source of truth in development: this reads the same
 * `db.changelog-master.xml` include order and runs the same `changes/*.sql` files, one
 * transaction each, recording the changeset id in `schema_migrations`.
 *
 * Interop: on a database Liquibase has already migrated, the ids in `databasechangelog` are
 * imported on first run so nothing is applied twice. A database migrated by this runner can be
 * handed back to Liquibase only after `liquibase changelog-sync` — don't alternate casually.
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import postgres from "postgres";

process.loadEnvFile(".env");

const CHANGELOG = "liquibase/changelog/db.changelog-master.xml";

interface Changeset {
  id: string;
  file: string;
  sql: string;
  checksum: string;
}

/** Read the master changelog's <include> order, then load each referenced changeset. */
function loadChangesets(): Changeset[] {
  const masterPath = path.resolve(CHANGELOG);
  const master = readFileSync(masterPath, "utf8");
  const dir = path.dirname(masterPath);

  const includes = [...master.matchAll(/<include\s+file="([^"]+)"/g)].map((m) => m[1]);
  if (includes.length === 0) throw new Error(`No <include> entries found in ${CHANGELOG}.`);

  return includes.map((rel) => {
    const file = path.join(dir, rel);
    const sql = readFileSync(file, "utf8");
    // Liquibase formatted SQL: "--changeset <author>:<id>"
    const id = sql.match(/--\s*changeset\s+[^:\s]+:(\S+)/)?.[1];
    if (!id) throw new Error(`No --changeset header in ${rel}`);
    return { id, file: rel, sql, checksum: createHash("sha256").update(sql).digest("hex").slice(0, 16) };
  });
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("✗ DATABASE_URL is not set (see .env).");
    process.exit(1);
  }
  const statusOnly = process.argv.includes("--status");
  const changesets = loadChangesets();
  // Notices here are all routine ("...already exists, skipping"); printing them would make a
  // clean install look like it errored.
  const sql = postgres(url, { max: 1, onnotice: () => {} });

  try {
    await sql`
      create table if not exists schema_migrations (
        id text primary key,
        checksum text not null,
        applied_at timestamptz not null default now()
      )
    `;

    // Adopt a Liquibase-managed database rather than re-running its changesets.
    const [{ exists: hasLiquibase }] = await sql<{ exists: boolean }[]>`
      select exists (select 1 from information_schema.tables where table_name = 'databasechangelog') as exists
    `;
    if (hasLiquibase) {
      const adopted = await sql`
        insert into schema_migrations (id, checksum)
        select id, 'liquibase' from databasechangelog
        on conflict (id) do nothing
        returning id
      `;
      if (adopted.length > 0) console.log(`= adopted ${adopted.length} changeset(s) already applied by Liquibase`);
    }

    const applied = new Set((await sql<{ id: string }[]>`select id from schema_migrations`).map((r) => r.id));
    const pending = changesets.filter((c) => !applied.has(c.id));

    if (pending.length === 0) {
      console.log(`✓ Up to date — ${changesets.length} changeset(s) applied.`);
      return;
    }

    if (statusOnly) {
      console.log(`${pending.length} pending changeset(s):`);
      for (const c of pending) console.log(`  - ${c.id}  (${c.file})`);
      return;
    }

    for (const c of pending) {
      await sql.begin(async (tx) => {
        // Simple protocol: these files hold several statements, which the extended protocol refuses.
        await tx.unsafe(c.sql).simple();
        await tx`insert into schema_migrations (id, checksum) values (${c.id}, ${c.checksum})`;
      });
      console.log(`+ applied ${c.id}`);
    }
    console.log(`✓ Applied ${pending.length} changeset(s).`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
