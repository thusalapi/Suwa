import { describe, it, expect, beforeEach } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, billItems } from "@/lib/db/schema";
import { createBill, recordPayment, getBill, BillError } from "@/lib/bills";
import { resetDb, seedBase } from "./helpers";

beforeEach(resetDb);

const oneItem = [{ serviceId: null, description: "FBC", quantity: 1, unitPrice: 100_00 }];

describe("createBill", () => {
  it("allocates gap-free bill numbers per clinic", async () => {
    const { clinicId, userId, patientId } = await seedBase();
    const a = await createBill(clinicId, userId, { patientId, discount: 0, items: oneItem });
    const b = await createBill(clinicId, userId, { patientId, discount: 0, items: oneItem });
    expect(a.billNumber).toBe(1);
    expect(b.billNumber).toBe(2);
  });

  it("computes totals with clinic tax and snapshots the line items", async () => {
    const { clinicId, userId, patientId } = await seedBase({ taxRate: 800 }); // 8.00%
    const { id } = await createBill(clinicId, userId, {
      patientId,
      discount: 50_00,
      items: [
        { serviceId: null, description: "FBC", quantity: 2, unitPrice: 100_00 }, // 200.00
        { serviceId: null, description: "Consult", quantity: 1, unitPrice: 100_00 }, // 100.00
      ],
    });
    const bill = await getBill(clinicId, id);
    expect(bill).not.toBeNull();
    // subtotal 300.00, discount 50.00, taxBase 250.00, tax 8% = 20.00, total 270.00
    expect(bill!.subtotal).toBe(300_00);
    expect(bill!.discount).toBe(50_00);
    expect(bill!.tax).toBe(20_00);
    expect(bill!.total).toBe(270_00);
    expect(bill!.balance).toBe(270_00);
    expect(bill!.items).toHaveLength(2);
    expect(bill!.items[0]).toMatchObject({ description: "FBC", quantity: 2, unitPrice: 100_00, lineTotal: 200_00 });
  });

  it("clamps a discount larger than the subtotal", async () => {
    const { clinicId, userId, patientId } = await seedBase();
    const { id } = await createBill(clinicId, userId, { patientId, discount: 999_00, items: oneItem });
    const bill = await getBill(clinicId, id);
    expect(bill!.discount).toBe(100_00); // clamped to subtotal
    expect(bill!.total).toBe(0);
  });

  it("writes a bill.create audit row in the same transaction", async () => {
    const { clinicId, userId, patientId } = await seedBase();
    const { id } = await createBill(clinicId, userId, { patientId, discount: 0, items: oneItem });
    const rows = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityId, id), eq(auditLogs.action, "bill.create")));
    expect(rows).toHaveLength(1);
    expect(rows[0].clinicId).toBe(clinicId);
  });

  it("rejects a bill with no items", async () => {
    const { clinicId, userId, patientId } = await seedBase();
    await expect(createBill(clinicId, userId, { patientId, discount: 0, items: [] })).rejects.toBeInstanceOf(BillError);
  });
});

describe("recordPayment", () => {
  async function freshBill(taxRate = 0) {
    const { clinicId, userId, patientId } = await seedBase({ taxRate });
    const { id } = await createBill(clinicId, userId, { patientId, discount: 0, items: oneItem }); // total 100.00
    return { clinicId, userId, id };
  }

  it("applies a partial payment and flips to paid when cleared", async () => {
    const { clinicId, userId, id } = await freshBill();
    await recordPayment(clinicId, userId, id, { amount: 60_00, method: "cash" });
    let bill = await getBill(clinicId, id);
    expect(bill!.amountPaid).toBe(60_00);
    expect(bill!.balance).toBe(40_00);
    expect(bill!.status).toBe("finalized");

    await recordPayment(clinicId, userId, id, { amount: 40_00, method: "card" });
    bill = await getBill(clinicId, id);
    expect(bill!.amountPaid).toBe(100_00);
    expect(bill!.balance).toBe(0);
    expect(bill!.status).toBe("paid");
    expect(bill!.payments).toHaveLength(2);
  });

  it("rejects a payment larger than the outstanding balance", async () => {
    const { clinicId, userId, id } = await freshBill();
    await expect(recordPayment(clinicId, userId, id, { amount: 150_00, method: "cash" })).rejects.toMatchObject({
      code: "exceeds_balance",
    });
  });

  it("rejects a payment against an already-settled bill", async () => {
    const { clinicId, userId, id } = await freshBill();
    await recordPayment(clinicId, userId, id, { amount: 100_00, method: "cash" });
    await expect(recordPayment(clinicId, userId, id, { amount: 1, method: "cash" })).rejects.toMatchObject({
      code: "already_settled",
    });
  });

  it("sums concurrent payments correctly (row lock serialises them)", async () => {
    const { clinicId, userId, id } = await freshBill();
    await Promise.all([
      recordPayment(clinicId, userId, id, { amount: 50_00, method: "cash" }),
      recordPayment(clinicId, userId, id, { amount: 50_00, method: "cash" }),
    ]);
    const bill = await getBill(clinicId, id);
    expect(bill!.amountPaid).toBe(100_00); // neither overwrote the other
    expect(bill!.balance).toBe(0);
    expect(bill!.status).toBe("paid");
    expect(bill!.payments).toHaveLength(2);
  });

  it("records a payment.create audit row", async () => {
    const { clinicId, userId, id } = await freshBill();
    await recordPayment(clinicId, userId, id, { amount: 10_00, method: "cash" });
    const rows = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityId, id), eq(auditLogs.action, "payment.create")));
    expect(rows).toHaveLength(1);
  });
});

describe("snapshot isolation", () => {
  it("keeps bill_items even though they reference no live service", async () => {
    const { clinicId, userId, patientId } = await seedBase();
    const { id } = await createBill(clinicId, userId, { patientId, discount: 0, items: oneItem });
    const items = await db.select().from(billItems).where(eq(billItems.billId, id));
    expect(items[0].serviceId).toBeNull();
    expect(items[0].description).toBe("FBC");
  });
});
