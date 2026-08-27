import { describe, it, beforeEach, expect } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, bills } from "@/lib/db/schema";
import { createBill, recordPayment, cancelBill, getBill, BillError } from "@/lib/bills";
import { resetDb, seedBase, seedClinic, seedUser, seedPatient } from "./helpers";

describe("cancelBill", () => {
  let clinicId: string;
  let userId: string;
  let patientId: string;

  beforeEach(async () => {
    await resetDb();
    ({ clinicId, userId, patientId } = await seedBase());
  });

  const newBill = () =>
    createBill(clinicId, userId, {
      patientId,
      discount: 0,
      items: [{ serviceId: null, description: "Full Blood Count", quantity: 1, unitPrice: 120_000 }],
    });

  it("marks the bill cancelled without deleting it, and keeps its number", async () => {
    const { id, billNumber } = await newBill();
    await cancelBill(clinicId, userId, id);

    const bill = await getBill(clinicId, id);
    expect(bill).not.toBeNull();
    expect(bill?.status).toBe("cancelled");
    expect(bill?.billNumber).toBe(billNumber);
    // The line items stay too — the record of what was billed is not erased.
    expect(bill?.items).toHaveLength(1);
  });

  it("writes a bill.cancel audit row carrying the reason", async () => {
    const { id, billNumber } = await newBill();
    await cancelBill(clinicId, userId, id, "Duplicate of #1 — keyed twice at the counter");

    const [audit] = await db
      .select({ action: auditLogs.action, metadata: auditLogs.metadata, userId: auditLogs.userId })
      .from(auditLogs)
      .where(and(eq(auditLogs.entityId, id), eq(auditLogs.action, "bill.cancel")));

    expect(audit).toBeDefined();
    expect(audit.userId).toBe(userId);
    expect(audit.metadata).toMatchObject({
      billNumber,
      reason: "Duplicate of #1 — keyed twice at the counter",
    });
  });

  it("omits the reason from the audit metadata when none is given", async () => {
    const { id } = await newBill();
    await cancelBill(clinicId, userId, id);

    const [audit] = await db
      .select({ metadata: auditLogs.metadata })
      .from(auditLogs)
      .where(and(eq(auditLogs.entityId, id), eq(auditLogs.action, "bill.cancel")));

    expect(audit.metadata).not.toHaveProperty("reason");
  });

  it("refuses a bill that has a payment against it", async () => {
    const { id } = await newBill();
    await recordPayment(clinicId, userId, id, { amount: 50_000, method: "cash" });

    await expect(cancelBill(clinicId, userId, id)).rejects.toBeInstanceOf(BillError);
    await expect(cancelBill(clinicId, userId, id)).rejects.toMatchObject({ code: "has_payments" });

    // And the bill is untouched — no half-applied cancellation.
    const bill = await getBill(clinicId, id);
    expect(bill?.status).toBe("finalized");
    expect(bill?.amountPaid).toBe(50_000);
  });

  it("refuses a fully paid bill", async () => {
    const { id } = await newBill();
    await recordPayment(clinicId, userId, id, { amount: 120_000, method: "card" });
    await expect(cancelBill(clinicId, userId, id)).rejects.toMatchObject({ code: "has_payments" });
    expect((await getBill(clinicId, id))?.status).toBe("paid");
  });

  it("is idempotent — cancelling twice is a no-op with a single audit row", async () => {
    const { id } = await newBill();
    await cancelBill(clinicId, userId, id);
    await cancelBill(clinicId, userId, id);

    const rows = await db
      .select({ id: auditLogs.id })
      .from(auditLogs)
      .where(and(eq(auditLogs.entityId, id), eq(auditLogs.action, "bill.cancel")));
    expect(rows).toHaveLength(1);
    expect((await getBill(clinicId, id))?.status).toBe("cancelled");
  });

  it("throws not_found for an unknown id", async () => {
    await expect(cancelBill(clinicId, userId, "00000000-0000-0000-0000-000000000000")).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("won't cancel another clinic's bill", async () => {
    const { id } = await newBill();
    const otherClinic = await seedClinic();
    const otherUser = await seedUser(otherClinic, "owner");

    await expect(cancelBill(otherClinic, otherUser, id)).rejects.toMatchObject({ code: "not_found" });
    expect((await getBill(clinicId, id))?.status).toBe("finalized");
  });

  it("blocks a payment afterwards — recordPayment already refuses a cancelled bill", async () => {
    const { id } = await newBill();
    await cancelBill(clinicId, userId, id);
    await expect(recordPayment(clinicId, userId, id, { amount: 1000, method: "cash" })).rejects.toMatchObject({
      code: "cancelled",
    });
  });

  it("drops the bill out of the outstanding figures", async () => {
    // A cancelled bill must not keep inflating what the clinic thinks it is owed. Both the
    // dashboard and the revenue report exclude `status = 'cancelled'`.
    const { id } = await newBill();
    const before = await db.select({ balance: bills.balance }).from(bills).where(eq(bills.id, id));
    expect(before[0].balance).toBe(120_000);

    await cancelBill(clinicId, userId, id);

    const { getDashboardStats } = await import("@/lib/dashboard");
    const stats = await getDashboardStats(clinicId);
    expect(stats.outstandingBalance).toBe(0);
    expect(stats.outstandingCount).toBe(0);
    expect(stats.billsToday).toBe(0); // cancelled bills are excluded from today's count too
  });

  it("leaves other bills for the same patient alone", async () => {
    const keep = await newBill();
    const drop = await newBill();
    await cancelBill(clinicId, userId, drop.id);

    expect((await getBill(clinicId, keep.id))?.status).toBe("finalized");
    expect((await getBill(clinicId, drop.id))?.status).toBe("cancelled");
  });

  it("works for a bill belonging to a second patient in the clinic", async () => {
    const otherPatient = await seedPatient(clinicId);
    const { id } = await createBill(clinicId, userId, {
      patientId: otherPatient,
      discount: 0,
      items: [{ serviceId: null, description: "X", quantity: 1, unitPrice: 1000 }],
    });
    await cancelBill(clinicId, userId, id);
    expect((await getBill(clinicId, id))?.status).toBe("cancelled");
  });
});
