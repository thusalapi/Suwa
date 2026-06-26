import { describe, it, expect, beforeEach } from "vitest";
import { getDashboardStats } from "@/lib/dashboard";
import { createBill, recordPayment } from "@/lib/bills";
import { resetDb, seedBase } from "./helpers";

beforeEach(resetDb);

const item = (price: number) => [{ serviceId: null, description: "Svc", quantity: 1, unitPrice: price }];

describe("getDashboardStats", () => {
  it("reports zeros for an empty clinic", async () => {
    const { clinicId } = await seedBase();
    const stats = await getDashboardStats(clinicId);
    expect(stats).toMatchObject({
      revenueToday: 0,
      billsToday: 0,
      billedToday: 0,
      pendingReports: 0,
      outstandingBalance: 0,
      outstandingCount: 0,
    });
  });

  it("aggregates today's bills, collected revenue, and outstanding balances", async () => {
    const { clinicId, userId, patientId } = await seedBase();

    // bill 1: 100.00, left unpaid → outstanding
    await createBill(clinicId, userId, { patientId, discount: 0, items: item(100_00) });
    // bill 2: 50.00, paid in full today → counts as revenue
    const b2 = await createBill(clinicId, userId, { patientId, discount: 0, items: item(50_00) });
    await recordPayment(clinicId, userId, b2.id, { amount: 50_00, method: "cash" });

    const stats = await getDashboardStats(clinicId);
    expect(stats.billsToday).toBe(2);
    expect(stats.billedToday).toBe(150_00);
    expect(stats.revenueToday).toBe(50_00);
    expect(stats.outstandingBalance).toBe(100_00);
    expect(stats.outstandingCount).toBe(1);
  });

  it("is scoped to the clinic", async () => {
    const a = await seedBase();
    const b = await seedBase();
    await createBill(a.clinicId, a.userId, { patientId: a.patientId, discount: 0, items: item(100_00) });

    const statsB = await getDashboardStats(b.clinicId);
    expect(statsB.billsToday).toBe(0);
    expect(statsB.outstandingBalance).toBe(0);
  });
});
