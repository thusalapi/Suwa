/**
 * Seed the lab's house-style report templates (Unawatuna Medical Centre format):
 * Fasting Blood Sugar + Blood Grouping & Rh.
 *
 *   npm run seed:templates
 *
 * Idempotent: skips a template whose name already exists for the clinic. Standalone connection
 * (does not import the "server-only" db client, which can't load outside the Next.js runtime),
 * mirroring scripts/seed-owner.ts. Inserts the template + a `template.create` audit row in one tx.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { clinics, users, reportTemplates, auditLogs } from "../src/lib/db/schema";
import { fastingBloodSugarTemplate, bloodGroupingTemplate } from "../src/lib/report-engine/examples";
import type { Template } from "../src/lib/report-engine";

process.loadEnvFile(".env");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("✗ DATABASE_URL is not set (see .env).");
  process.exit(1);
}

async function main() {
  const sql = postgres(databaseUrl!, { max: 1 });
  const db = drizzle(sql);
  try {
    const [clinic] = await db.select({ id: clinics.id, name: clinics.name }).from(clinics).limit(1);
    if (!clinic) throw new Error("No clinic found — run `npm run seed:owner` first.");

    const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.clinicId, clinic.id)).limit(1);
    if (!owner) throw new Error(`No user found for clinic "${clinic.name}".`);

    const existing = await db
      .select({ name: reportTemplates.name })
      .from(reportTemplates)
      .where(eq(reportTemplates.clinicId, clinic.id));
    const have = new Set(existing.map((t) => t.name));

    const seeds: Template[] = [fastingBloodSugarTemplate, bloodGroupingTemplate];
    for (const tpl of seeds) {
      if (have.has(tpl.name)) {
        console.log(`= skip "${tpl.name}" (already exists)`);
        continue;
      }
      await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(reportTemplates)
          .values({ clinicId: clinic.id, name: tpl.name, version: 1, schema: tpl, createdBy: owner.id })
          .returning({ id: reportTemplates.id });
        await tx.insert(auditLogs).values({
          clinicId: clinic.id,
          userId: owner.id,
          action: "template.create",
          entityType: "template",
          entityId: row.id,
          metadata: { version: 1, seeded: true },
        });
        console.log(`+ created "${tpl.name}" (${row.id})`);
      });
    }
    console.log(`✓ Templates seeded for clinic "${clinic.name}".`);
  } finally {
    await sql.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(`✗ ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  });
