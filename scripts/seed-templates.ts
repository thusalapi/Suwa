/**
 * Seed the lab's house-style report templates (Unawatuna Medical Centre format):
 * Fasting Blood Sugar, Blood Grouping & Rh, and Full Blood Count.
 *
 *   npm run seed:templates
 *   npm run seed:templates -- --replace "Full Blood Count"
 *
 * Idempotent: skips a template whose name already exists for the clinic — unless it's named with
 * --replace, which overwrites it as a new version (issued reports keep their frozen snapshot). Standalone connection
 * (does not import the "server-only" db client, which can't load outside the Next.js runtime),
 * mirroring scripts/seed-owner.ts. Inserts the template + a `template.create` audit row in one tx.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { and, eq } from "drizzle-orm";
import { clinics, users, reportTemplates, auditLogs } from "../src/lib/db/schema";
import {
  fastingBloodSugarTemplate,
  bloodGroupingTemplate,
  fullBloodCountTemplate,
} from "../src/lib/report-engine/examples";
import { parseTemplate, type Template } from "../src/lib/report-engine";

process.loadEnvFile(".env");

const replaceIdx = process.argv.indexOf("--replace");
const replaceName = replaceIdx >= 0 ? process.argv[replaceIdx + 1] : undefined;

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
      .select({ id: reportTemplates.id, name: reportTemplates.name, version: reportTemplates.version })
      .from(reportTemplates)
      .where(eq(reportTemplates.clinicId, clinic.id));
    const have = new Map(existing.map((t) => [t.name, t]));

    const seeds: Template[] = [fastingBloodSugarTemplate, bloodGroupingTemplate, fullBloodCountTemplate];
    for (const tpl of seeds) {
      parseTemplate(tpl); // fail loudly on an invalid seed rather than store it
      const current = have.get(tpl.name);
      if (current && tpl.name === replaceName) {
        const version = current.version + 1;
        await db.transaction(async (tx) => {
          await tx
            .update(reportTemplates)
            .set({ version, schema: { ...tpl, version } })
            .where(and(eq(reportTemplates.id, current.id), eq(reportTemplates.clinicId, clinic.id)));
          await tx.insert(auditLogs).values({
            clinicId: clinic.id,
            userId: owner.id,
            action: "template.update",
            entityType: "template",
            entityId: current.id,
            metadata: { version, seeded: true },
          });
        });
        console.log(`~ replaced "${tpl.name}" → v${version} (${current.id})`);
        continue;
      }
      if (current) {
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
