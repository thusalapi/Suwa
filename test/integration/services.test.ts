import { describe, it, expect, beforeEach } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { createService, updateService, setServiceActive, getService, listServices } from "@/lib/catalog";
import { resetDb, seedClinic, seedUser } from "./helpers";

beforeEach(resetDb);

async function ctx() {
  const clinicId = await seedClinic();
  const userId = await seedUser(clinicId, "owner");
  return { clinicId, userId };
}

describe("createService", () => {
  it("creates a service (price in minor units) and audits it", async () => {
    const { clinicId, userId } = await ctx();
    const id = await createService(clinicId, userId, { name: "FBC", defaultPrice: 500_00, category: "Haematology" });

    const s = await getService(clinicId, id);
    expect(s).toMatchObject({ name: "FBC", defaultPrice: 500_00, category: "Haematology", active: true });

    const audit = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityId, id), eq(auditLogs.action, "service.create")));
    expect(audit).toHaveLength(1);
  });

  it("maps an empty category to NULL", async () => {
    const { clinicId, userId } = await ctx();
    const id = await createService(clinicId, userId, { name: "X-Ray", defaultPrice: 100_00, category: "" });
    expect((await getService(clinicId, id))!.category).toBeNull();
  });
});

describe("updateService / setServiceActive", () => {
  it("updates fields and audits the change", async () => {
    const { clinicId, userId } = await ctx();
    const id = await createService(clinicId, userId, { name: "FBC", defaultPrice: 500_00, category: "" });
    await updateService(clinicId, userId, id, { name: "Full Blood Count", defaultPrice: 600_00, category: "Haem" });

    const s = await getService(clinicId, id);
    expect(s).toMatchObject({ name: "Full Blood Count", defaultPrice: 600_00, category: "Haem" });
    const audit = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityId, id), eq(auditLogs.action, "service.update")));
    expect(audit).toHaveLength(1);
  });

  it("soft-deactivates and reactivates with matching audit actions", async () => {
    const { clinicId, userId } = await ctx();
    const id = await createService(clinicId, userId, { name: "FBC", defaultPrice: 500_00, category: "" });

    await setServiceActive(clinicId, userId, id, false);
    expect((await getService(clinicId, id))!.active).toBe(false);
    await setServiceActive(clinicId, userId, id, true);
    expect((await getService(clinicId, id))!.active).toBe(true);

    const actions = (
      await db.select({ action: auditLogs.action }).from(auditLogs).where(eq(auditLogs.entityId, id))
    ).map((r) => r.action);
    expect(actions).toContain("service.deactivate");
    expect(actions).toContain("service.activate");
  });
});

describe("listServices", () => {
  it("orders by name, filters to active with activeOnly, and is tenant-scoped", async () => {
    const { clinicId, userId } = await ctx();
    const other = await ctx();
    await createService(clinicId, userId, { name: "Zinc", defaultPrice: 100, category: "" });
    const a = await createService(clinicId, userId, { name: "Albumin", defaultPrice: 100, category: "" });
    await setServiceActive(clinicId, userId, a, false);
    await createService(other.clinicId, other.userId, { name: "Other", defaultPrice: 100, category: "" });

    const all = await listServices(clinicId);
    expect(all.map((s) => s.name)).toEqual(["Albumin", "Zinc"]); // name order
    const active = await listServices(clinicId, true);
    expect(active.map((s) => s.name)).toEqual(["Zinc"]); // Albumin deactivated
  });
});
