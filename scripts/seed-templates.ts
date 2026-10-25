/**
 * Seed the lab's house-style report templates (Unawatuna Medical Centre format):
 * Fasting Blood Sugar, Blood Grouping & Rh, Full Blood Count, Serum Creatinine, Urine Microalbumin, Lipid Profile, Urine Full Report, Cholesterol, ESR,
 * Renal Function Test, Blood Sugar Series Test, Liver Profile Test, Random Blood Sugar, and
 * Postprandial Blood Sugar, SGOT (AST), Amylase, Uric Acid, Gamma GT, Alkaline Phosphatase,
 * Electrolytes, Glyco - Haemoglobin, Bilirubin, and Total Protein.
 *
 *   npm run seed:templates
 *   npm run seed:templates -- --replace "Full Blood Count"
 *
 * Every template seeded here is LOCKED (read-only in the UI): system templates are only changed
 * through this script. Idempotent: an existing template of the same name is left as-is (just
 * locked, if it wasn't) — unless it's named with --replace, which overwrites it as a new version
 * (issued reports keep their frozen snapshot). Standalone connection
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
  serumCreatinineTemplate,
  urineMicroalbuminTemplate,
  lipidProfileTemplate,
  urineFullReportTemplate,
  cholesterolTemplate,
  esrTemplate,
  renalFunctionTemplate,
  bloodSugarSeriesTemplate,
  liverProfileTemplate,
  TEMPLATE_ALIASES,
  randomBloodSugarTemplate,
  postprandialBloodSugarTemplate,
  sgotTemplate,
  amylaseTemplate,
  uricAcidTemplate,
  gammaGtTemplate,
  alkalinePhosphataseTemplate,
  electrolytesTemplate,
  glycoHaemoglobinTemplate,
  bilirubinTemplate,
  totalProteinTemplate,
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
      .select({
        id: reportTemplates.id,
        name: reportTemplates.name,
        version: reportTemplates.version,
        schema: reportTemplates.schema,
      })
      .from(reportTemplates)
      .where(eq(reportTemplates.clinicId, clinic.id));
    const have = new Map(existing.map((t) => [t.name, t]));

    const seeds: Template[] = [
      fastingBloodSugarTemplate,
      bloodGroupingTemplate,
      fullBloodCountTemplate,
      serumCreatinineTemplate,
      urineMicroalbuminTemplate,
      lipidProfileTemplate,
      urineFullReportTemplate,
      cholesterolTemplate,
      esrTemplate,
      renalFunctionTemplate,
      bloodSugarSeriesTemplate,
      liverProfileTemplate,
      randomBloodSugarTemplate,
      postprandialBloodSugarTemplate,
      sgotTemplate,
      amylaseTemplate,
      uricAcidTemplate,
      gammaGtTemplate,
      alkalinePhosphataseTemplate,
      electrolytesTemplate,
      glycoHaemoglobinTemplate,
      bilirubinTemplate,
      totalProteinTemplate,
    ].map((t) => parseTemplate({ ...t, locked: true, aliases: TEMPLATE_ALIASES[t.name] })); // fail loudly on an invalid seed
    for (const tpl of seeds) {
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
      const stored = current?.schema as Template | undefined;
      const staleAliases =
        !!tpl.aliases?.length && JSON.stringify(stored?.aliases ?? []) !== JSON.stringify(tpl.aliases);
      if (current && (!stored?.locked || staleAliases)) {
        // Lock + refresh search keywords in place — the report content (and so the version) is unchanged.
        await db.transaction(async (tx) => {
          await tx
            .update(reportTemplates)
            .set({ schema: { ...stored!, locked: true, ...(tpl.aliases ? { aliases: tpl.aliases } : {}) } })
            .where(and(eq(reportTemplates.id, current.id), eq(reportTemplates.clinicId, clinic.id)));
          await tx.insert(auditLogs).values({
            clinicId: clinic.id,
            userId: owner.id,
            action: "template.update",
            entityType: "template",
            entityId: current.id,
            metadata: { version: current.version, locked: true, aliases: tpl.aliases ?? [], seeded: true },
          });
        });
        console.log(`🔒 locked/keywords "${tpl.name}" (v${current.version}, content unchanged)`);
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
