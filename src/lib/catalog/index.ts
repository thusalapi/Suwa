import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { services } from "@/lib/db/schema";
import { recordAudit } from "@/lib/audit";

/** A catalog service/price. `defaultPrice` is integer minor units (LKR cents). */
export interface ServiceItem {
  id: string;
  name: string;
  defaultPrice: number;
  category: string | null;
  active: boolean;
}

/** List a clinic's services (active first via name order). `activeOnly` for the bill picker. */
export async function listServices(clinicId: string, activeOnly = false): Promise<ServiceItem[]> {
  const where = activeOnly
    ? and(eq(services.clinicId, clinicId), eq(services.active, true))
    : eq(services.clinicId, clinicId);

  return db
    .select({
      id: services.id,
      name: services.name,
      defaultPrice: services.defaultPrice,
      category: services.category,
      active: services.active,
    })
    .from(services)
    .where(where)
    .orderBy(asc(services.name));
}

/** Load one service (tenant-scoped), or null. */
export async function getService(clinicId: string, id: string): Promise<ServiceItem | null> {
  const [row] = await db
    .select({
      id: services.id,
      name: services.name,
      defaultPrice: services.defaultPrice,
      category: services.category,
      active: services.active,
    })
    .from(services)
    .where(and(eq(services.clinicId, clinicId), eq(services.id, id)))
    .limit(1);
  return row ?? null;
}

export interface UpsertServiceInput {
  name: string;
  defaultPrice: number; // minor units
  category: string;
}

/** Create a service (insert + `service.create` audit in one transaction). Returns the id. */
export async function createService(clinicId: string, userId: string, input: UpsertServiceInput): Promise<string> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(services)
      .values({
        clinicId,
        name: input.name,
        defaultPrice: input.defaultPrice,
        category: input.category || null,
      })
      .returning({ id: services.id });

    await recordAudit({ clinicId, userId, action: "service.create", entityType: "service", entityId: row.id }, tx);
    return row.id;
  });
}

/** Update a service (update + `service.update` audit in one transaction). Tenant-scoped. */
export async function updateService(
  clinicId: string,
  userId: string,
  id: string,
  input: UpsertServiceInput,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(services)
      .set({ name: input.name, defaultPrice: input.defaultPrice, category: input.category || null })
      .where(and(eq(services.id, id), eq(services.clinicId, clinicId)));

    await recordAudit({ clinicId, userId, action: "service.update", entityType: "service", entityId: id }, tx);
  });
}

/** Activate / deactivate a service (soft, never hard-delete — keeps past bills' references valid). */
export async function setServiceActive(clinicId: string, userId: string, id: string, active: boolean): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(services)
      .set({ active })
      .where(and(eq(services.id, id), eq(services.clinicId, clinicId)));

    await recordAudit(
      {
        clinicId,
        userId,
        action: active ? "service.activate" : "service.deactivate",
        entityType: "service",
        entityId: id,
      },
      tx,
    );
  });
}
