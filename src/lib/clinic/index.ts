import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clinics } from "@/lib/db/schema";
import { recordAudit } from "@/lib/audit";

/** The clinic identity + billing defaults, as read by settings and PDF/branding code. */
export interface Clinic {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  logoUrl: string | null;
  currency: string;
  /** Basis points, e.g. 800 = 8.00%. */
  taxRate: number;
}

/** Load one clinic by id. Tenant-scoped reads always pass the caller's clinicId. */
export async function getClinic(clinicId: string): Promise<Clinic | null> {
  const [row] = await db
    .select({
      id: clinics.id,
      name: clinics.name,
      address: clinics.address,
      phone: clinics.phone,
      logoUrl: clinics.logoUrl,
      currency: clinics.currency,
      taxRate: clinics.taxRate,
    })
    .from(clinics)
    .where(eq(clinics.id, clinicId))
    .limit(1);
  return row ?? null;
}

export interface UpdateClinicInput {
  name: string;
  address: string;
  phone: string;
  logoUrl: string;
  currency: string;
  /** Basis points (already converted from the UI percentage). */
  taxRate: number;
}

/**
 * Update clinic settings. The change and its audit row commit in one transaction — if the
 * audit can't be written, the update is rolled back (see suwa-backend "standard shape").
 */
export async function updateClinicSettings(
  clinicId: string,
  userId: string,
  input: UpdateClinicInput,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(clinics)
      .set({
        name: input.name,
        address: input.address || null,
        phone: input.phone || null,
        logoUrl: input.logoUrl || null,
        currency: input.currency,
        taxRate: input.taxRate,
      })
      .where(eq(clinics.id, clinicId));

    await recordAudit(
      {
        clinicId,
        userId,
        action: "clinic.update",
        entityType: "clinic",
        entityId: clinicId,
        metadata: { currency: input.currency, taxRate: input.taxRate },
      },
      tx,
    );
  });
}
