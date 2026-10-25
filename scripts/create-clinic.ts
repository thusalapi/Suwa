/**
 * Add a clinic + its owner to a shared (hosted, multi-clinic) database.
 *
 *   npm run clinic:create -- --clinic "Clinic Name" --name "Owner Name" \
 *     --email owner@clinic.lk --password "a-strong-password"
 *
 * Unlike `seed:owner` (first-time single-clinic setup, refuses if any owner exists), this refuses
 * only a duplicate clinic name or an email that is already in use. Afterwards load the clinic's
 * report templates with `npm run seed:templates -- --clinic "Clinic Name"`.
 * Clinic + owner + audit row are written in one transaction.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, sql as dsql } from "drizzle-orm";
import { hash } from "@node-rs/argon2";
import { auditLogs, clinics, users } from "../src/lib/db/schema";
import { arg } from "./lib/clinic";

process.loadEnvFile(".env");

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

async function main() {
  const clinicName = arg("--clinic")?.trim();
  const name = arg("--name")?.trim();
  const email = arg("--email")?.trim().toLowerCase();
  const password = arg("--password");

  if (!clinicName || !name || !email || !password) {
    fail(
      'Missing args. Usage: npm run clinic:create -- --clinic "Name" --name "Owner" --email a@b.lk --password "secret"',
    );
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("Invalid email address.");
  if (password.length < 8) fail("Password must be at least 8 characters.");

  const url = process.env.DATABASE_URL;
  if (!url) fail("DATABASE_URL is not set — configure .env first.");

  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql);
  try {
    const [sameName] = await db
      .select({ id: clinics.id })
      .from(clinics)
      .where(dsql`lower(${clinics.name}) = ${clinicName.toLowerCase()}`)
      .limit(1);
    if (sameName) fail(`A clinic named "${clinicName}" already exists.`);

    const [sameEmail] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (sameEmail) fail(`The email ${email} is already in use.`);

    const passwordHash = await hash(password);
    const clinicId = await db.transaction(async (tx) => {
      const [clinic] = await tx.insert(clinics).values({ name: clinicName }).returning({ id: clinics.id });
      const [owner] = await tx
        .insert(users)
        .values({ clinicId: clinic.id, name, email, role: "owner", passwordHash, mustReset: false })
        .returning({ id: users.id });
      await tx.insert(auditLogs).values({
        clinicId: clinic.id,
        userId: owner.id,
        action: "clinic.create",
        entityType: "clinic",
        entityId: clinic.id,
        metadata: { owner: email, via: "clinic:create" },
      });
      return clinic.id;
    });

    console.log(`✓ Created clinic "${clinicName}" (${clinicId}) with owner ${email}.`);
    console.log(`  Next: npm run seed:templates -- --clinic "${clinicName}"`);
    console.log("  Then the owner fills in Settings (address, phone, footer text) and invites staff from Team.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
