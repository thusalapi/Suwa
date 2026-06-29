/**
 * Seed an ISOLATED end-to-end test tenant so Playwright has a known login and never touches the
 * real clinic's data. Idempotent — safe to re-run (it re-asserts the owner's password, and adds
 * any missing templates/services).
 *
 *   npm run seed:e2e
 *
 * Creates: clinic "E2E Test Clinic" + owner (E2E_EMAIL / E2E_PASSWORD, default below) + the three
 * report templates + one catalog service. Standalone connection (mirrors scripts/seed-owner.ts).
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { and, eq } from "drizzle-orm";
import { hash } from "@node-rs/argon2";
import { clinics, users, reportTemplates, services } from "../src/lib/db/schema";
import { fbcTemplate, fastingBloodSugarTemplate, bloodGroupingTemplate } from "../src/lib/report-engine/examples";
import type { Template } from "../src/lib/report-engine";

process.loadEnvFile(".env");

const CLINIC = "E2E Test Clinic";
const EMAIL = (process.env.E2E_EMAIL ?? "e2e.owner@suwa.test").toLowerCase();
const PASSWORD = process.env.E2E_PASSWORD ?? "Passw0rd!";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("✗ DATABASE_URL is not set (see .env).");
    process.exit(1);
  }
  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql);
  try {
    // 1. Clinic (by name).
    let [clinic] = await db.select({ id: clinics.id }).from(clinics).where(eq(clinics.name, CLINIC));
    if (!clinic) {
      [clinic] = await db.insert(clinics).values({ name: CLINIC }).returning({ id: clinics.id });
      console.log(`+ clinic "${CLINIC}"`);
    }

    // 2. Owner (by email) — upsert the password so the known login always works.
    const passwordHash = await hash(PASSWORD);
    const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.email, EMAIL));
    let ownerId: string;
    if (owner) {
      await db.update(users).set({ passwordHash, mustReset: false }).where(eq(users.id, owner.id));
      ownerId = owner.id;
      console.log(`= owner ${EMAIL} (password reset)`);
    } else {
      const [row] = await db
        .insert(users)
        .values({ clinicId: clinic.id, name: "E2E Owner", email: EMAIL, role: "owner", passwordHash, mustReset: false })
        .returning({ id: users.id });
      ownerId = row.id;
      console.log(`+ owner ${EMAIL}`);
    }

    // 3. Report templates (by name).
    const tpls: Template[] = [fbcTemplate, fastingBloodSugarTemplate, bloodGroupingTemplate];
    for (const tpl of tpls) {
      const [exists] = await db
        .select({ id: reportTemplates.id })
        .from(reportTemplates)
        .where(and(eq(reportTemplates.clinicId, clinic.id), eq(reportTemplates.name, tpl.name)));
      if (!exists) {
        await db
          .insert(reportTemplates)
          .values({ clinicId: clinic.id, name: tpl.name, version: 1, schema: tpl, createdBy: ownerId });
        console.log(`+ template "${tpl.name}"`);
      }
    }

    // 4. One catalog service (by name).
    const [svc] = await db
      .select({ id: services.id })
      .from(services)
      .where(and(eq(services.clinicId, clinic.id), eq(services.name, "Consultation")));
    if (!svc) {
      await db.insert(services).values({ clinicId: clinic.id, name: "Consultation", defaultPrice: 150_000 });
      console.log(`+ service "Consultation"`);
    }

    console.log(`✓ E2E tenant ready. Login: ${EMAIL} / ${PASSWORD}`);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
