/**
 * One-time setup: create the clinic + its first OWNER account.
 *
 * There is no public sign-up (single-clinic install) — the owner is seeded here, then invites
 * staff/doctor from settings. Run on the clinic PC after Postgres + Liquibase are ready:
 *
 *   npm run seed:owner -- --clinic "Suwa Medical Centre" \
 *     --name "Dr. Perera" --email owner@clinic.lk --password "a-strong-password"
 *
 * Idempotent guard: refuses to run if an owner already exists. Standalone connection (does
 * not import the "server-only" db client, which can't load outside the Next.js runtime).
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { hash } from "@node-rs/argon2";
import { clinics, users } from "../src/lib/db/schema";

// Node 20.12+/24: load .env without a dependency.
process.loadEnvFile(".env");

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

async function main() {
  const clinicName = arg("--clinic");
  const name = arg("--name");
  const emailRaw = arg("--email");
  const password = arg("--password");

  if (!clinicName || !name || !emailRaw || !password) {
    fail(
      'Missing args. Usage: npm run seed:owner -- --clinic "Name" --name "Owner" --email a@b.lk --password "secret"',
    );
  }
  const email = emailRaw!.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("Invalid email address.");
  if (password!.length < 8) fail("Password must be at least 8 characters.");

  const url = process.env.DATABASE_URL;
  if (!url) fail("DATABASE_URL is not set — configure .env first.");

  const sql = postgres(url!, { max: 1 });
  const db = drizzle(sql, { schema: { clinics, users } });

  try {
    const existingOwner = await db.select({ id: users.id }).from(users).where(eq(users.role, "owner")).limit(1);
    if (existingOwner.length > 0) {
      fail("An owner already exists. Seeding is a one-time operation; aborting.");
    }

    const passwordHash = await hash(password!);

    await db.transaction(async (tx) => {
      const [clinic] = await tx.insert(clinics).values({ name: clinicName! }).returning({ id: clinics.id });
      await tx.insert(users).values({
        clinicId: clinic.id,
        name: name!,
        email,
        role: "owner",
        passwordHash,
        mustReset: false, // owner sets their own password here, no forced reset.
      });
    });

    console.log(`✓ Owner account created for ${email} at clinic "${clinicName}".`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
