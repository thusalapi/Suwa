import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { bills } from "@/lib/db/schema";
import { getRevenueReport, resolveRange } from "@/lib/analytics";
import { createBill, recordPayment } from "@/lib/bills";
import { resetDb, seedBase } from "./helpers";

beforeEach(resetDb);

describe("getRevenueReport", () => {
  it("summarises billed, collected, by-service, and outstanding for the range", async () => {
    const { clinicId, userId, patientId } = await seedBase();

    const b1 = await createBill(clinicId, userId, {
      patientId,
      discount: 0,
      items: [{ serviceId: null, description: "FBC", quantity: 1, unitPrice: 100_00 }],
    });
    await recordPayment(clinicId, userId, b1.id, { amount: 60_00, method: "cash" });

    const b2 = await createBill(clinicId, userId, {
      patientId,
      discount: 0,
      items: [{ serviceId: null, description: "Consult", quantity: 1, unitPrice: 50_00 }],
    });
    await recordPayment(clinicId, userId, b2.id, { amount: 50_00, method: "card" });

    const report = await getRevenueReport(clinicId, resolveRange());
    expect(report.billed).toBe(150_00);
    expect(report.collected).toBe(110_00);
    expect(report.billCount).toBe(2);

    expect(report.byService).toEqual([
      { description: "FBC", quantity: 1, amount: 100_00 },
      { description: "Consult", quantity: 1, amount: 50_00 },
    ]);

    expect(report.outstanding).toHaveLength(1);
    expect(report.outstanding[0]).toMatchObject({ balance: 40_00, total: 100_00 });
    expect(report.outstandingTotal).toBe(40_00);
  });

  it("groups the same service description across bills", async () => {
    const { clinicId, userId, patientId } = await seedBase();
    for (const price of [100_00, 50_00]) {
      await createBill(clinicId, userId, {
        patientId,
        discount: 0,
        items: [{ serviceId: null, description: "FBC", quantity: 1, unitPrice: price }],
      });
    }
    const report = await getRevenueReport(clinicId, resolveRange());
    expect(report.byService).toEqual([{ description: "FBC", quantity: 2, amount: 150_00 }]);
  });

  it("outstandingTotal sums ALL open bills, not just the capped (200-row) list", async () => {
    const { clinicId, userId, patientId } = await seedBase();
    // 201 open bills of 10.00 each, inserted directly for speed.
    await db.insert(bills).values(
      Array.from({ length: 201 }, (_, i) => ({
        clinicId,
        patientId,
        billNumber: i + 1,
        status: "finalized" as const,
        subtotal: 10_00,
        total: 10_00,
        amountPaid: 0,
        balance: 10_00,
        createdBy: userId,
      })),
    );

    const report = await getRevenueReport(clinicId, resolveRange());
    expect(report.outstanding).toHaveLength(200); // list is capped for display
    expect(report.outstandingTotal).toBe(201 * 10_00); // total is not
  });
});
