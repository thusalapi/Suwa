import "server-only";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { patients } from "@/lib/db/schema";
import { recordAudit } from "@/lib/audit";
import type { PatientInput } from "@/lib/schema/patient";

/** Row shape for the patient list/search table. */
export interface PatientListItem {
  id: string;
  fullName: string;
  phone: string;
  nic: string | null;
  gender: string | null;
}

/** Full patient record for the detail/edit screens. */
export interface Patient extends PatientListItem {
  dob: string | null;
  address: string | null;
  notes: string | null;
  createdAt: Date;
}

const SEARCH_LIMIT = 50;

/**
 * Search patients within a clinic by phone or name (case-insensitive, partial). Empty query
 * returns the most recent patients. Always tenant-scoped.
 */
export async function searchPatients(clinicId: string, query: string): Promise<PatientListItem[]> {
  const q = query.trim();
  const cols = {
    id: patients.id,
    fullName: patients.fullName,
    phone: patients.phone,
    nic: patients.nic,
    gender: patients.gender,
  };

  if (!q) {
    return db
      .select(cols)
      .from(patients)
      .where(eq(patients.clinicId, clinicId))
      .orderBy(desc(patients.createdAt))
      .limit(SEARCH_LIMIT);
  }

  const like = `%${q}%`;
  return db
    .select(cols)
    .from(patients)
    .where(
      and(eq(patients.clinicId, clinicId), or(ilike(patients.phone, like), ilike(patients.fullName, like))),
    )
    .orderBy(patients.fullName)
    .limit(SEARCH_LIMIT);
}

/** Load one patient (tenant-scoped), or null. */
export async function getPatient(clinicId: string, id: string): Promise<Patient | null> {
  const [row] = await db
    .select({
      id: patients.id,
      fullName: patients.fullName,
      phone: patients.phone,
      nic: patients.nic,
      gender: patients.gender,
      dob: patients.dob,
      address: patients.address,
      notes: patients.notes,
      createdAt: patients.createdAt,
    })
    .from(patients)
    .where(and(eq(patients.clinicId, clinicId), eq(patients.id, id)))
    .limit(1);
  return row ?? null;
}

/**
 * Find a patient by exact phone within a clinic (the dedupe lookup). `excludeId` skips the
 * patient being edited so they don't collide with themselves.
 */
export async function findByPhone(
  clinicId: string,
  phone: string,
  excludeId?: string,
): Promise<{ id: string; fullName: string } | null> {
  const [row] = await db
    .select({ id: patients.id, fullName: patients.fullName })
    .from(patients)
    .where(and(eq(patients.clinicId, clinicId), eq(patients.phone, phone)))
    .limit(1);
  if (!row) return null;
  if (excludeId && row.id === excludeId) return null;
  return row;
}

/** Map empty strings from the form to NULL for optional columns. */
function normalize(input: PatientInput) {
  return {
    fullName: input.fullName,
    phone: input.phone,
    nic: input.nic || null,
    gender: input.gender || null,
    dob: input.dob || null,
    address: input.address || null,
    notes: input.notes || null,
  };
}

/** Create a patient (insert + `patient.create` audit in one transaction). Returns the id. */
export async function createPatient(
  clinicId: string,
  userId: string,
  input: PatientInput,
): Promise<string> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(patients)
      .values({ clinicId, ...normalize(input) })
      .returning({ id: patients.id });

    await recordAudit(
      { clinicId, userId, action: "patient.create", entityType: "patient", entityId: row.id },
      tx,
    );
    return row.id;
  });
}

/** Update a patient (update + `patient.update` audit in one transaction). Tenant-scoped. */
export async function updatePatient(
  clinicId: string,
  userId: string,
  id: string,
  input: PatientInput,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(patients)
      .set(normalize(input))
      .where(and(eq(patients.id, id), eq(patients.clinicId, clinicId)));

    await recordAudit(
      { clinicId, userId, action: "patient.update", entityType: "patient", entityId: id },
      tx,
    );
  });
}
