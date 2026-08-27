import { describe, it, expect, beforeEach } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { getClinic, updateClinicSettings } from "@/lib/clinic";
import { resetDb, seedClinic, seedUser } from "./helpers";

beforeEach(resetDb);

describe("clinic settings", () => {
  it("reads a clinic with its defaults (showReportQr on, no fax/email yet)", async () => {
    const clinicId = await seedClinic();
    const c = await getClinic(clinicId);
    expect(c).toMatchObject({ name: "Test Clinic", currency: "LKR", taxRate: 0, showReportQr: true });
    expect(c!.fax).toBeNull();
    expect(c!.email).toBeNull();
  });

  it("persists every field (incl. fax/email/showReportQr) and audits the update", async () => {
    const clinicId = await seedClinic();
    const userId = await seedUser(clinicId, "owner");

    await updateClinicSettings(clinicId, userId, {
      name: "Unawatuna Medical Centre",
      address: "No.01, Dalawella Road",
      phone: "091-2250755",
      fax: "091-2250755",
      email: "umedic@hotmail.com",
      logoUrl: "",
      currency: "LKR",
      taxRate: 800,
      showReportQr: false,
    });

    const c = await getClinic(clinicId);
    expect(c).toMatchObject({
      name: "Unawatuna Medical Centre",
      address: "No.01, Dalawella Road",
      phone: "091-2250755",
      fax: "091-2250755",
      email: "umedic@hotmail.com",
      taxRate: 800,
      showReportQr: false,
    });
    expect(c!.logoUrl).toBeNull(); // empty string → NULL

    const audit = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityId, clinicId), eq(auditLogs.action, "clinic.update")));
    expect(audit).toHaveLength(1);
    expect(audit[0].metadata).toMatchObject({ currency: "LKR", taxRate: 800 });
  });
});
