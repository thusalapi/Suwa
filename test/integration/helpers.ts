import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { clinics, users, patients, type UserRole } from "@/lib/db/schema";

/** Empty every table between tests so each starts from a clean slate. */
export async function resetDb(): Promise<void> {
  await db.execute(
    sql`TRUNCATE audit_logs, payments, bill_items, bills, reports, report_templates,
        services, patients, users, clinics RESTART IDENTITY CASCADE`,
  );
}

export async function seedClinic(opts: { taxRate?: number } = {}): Promise<string> {
  const [c] = await db
    .insert(clinics)
    .values({ name: "Test Clinic", taxRate: opts.taxRate ?? 0 })
    .returning({ id: clinics.id });
  return c.id;
}

export async function seedUser(clinicId: string, role: UserRole = "staff"): Promise<string> {
  const [u] = await db
    .insert(users)
    .values({ clinicId, name: "Tester", email: `t-${randomUUID()}@clinic.lk`, role, passwordHash: "x", mustReset: false })
    .returning({ id: users.id });
  return u.id;
}

export async function seedPatient(clinicId: string): Promise<string> {
  const [p] = await db
    .insert(patients)
    .values({ clinicId, fullName: "Test Patient", phone: `07${Math.floor(Math.random() * 1e8)}` })
    .returning({ id: patients.id });
  return p.id;
}

/** A clinic + staff user + patient — the common starting point for a billing test. */
export async function seedBase(opts: { taxRate?: number } = {}) {
  const clinicId = await seedClinic(opts);
  const userId = await seedUser(clinicId);
  const patientId = await seedPatient(clinicId);
  return { clinicId, userId, patientId };
}
