import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, type Tx } from "@/lib/db";
import { bills, billItems, payments, patients, users, type BillStatus, type PaymentMethod } from "@/lib/db/schema";
import { recordAudit } from "@/lib/audit";
import { getClinic } from "@/lib/clinic";

/** Discriminator so the action layer can map a failure to a specific i18n message. */
export type BillErrorCode = "empty" | "not_found" | "cancelled" | "already_settled" | "exceeds_balance";

export class BillError extends Error {
  constructor(
    message: string,
    readonly code?: BillErrorCode,
  ) {
    super(message);
  }
}

/** A line to bill. unitPrice is integer minor units (snapshotted onto the bill_item). */
export interface BillLineInput {
  serviceId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateBillInput {
  patientId: string;
  discount: number; // minor units
  items: BillLineInput[];
}

export interface BillListItem {
  id: string;
  billNumber: number;
  status: BillStatus;
  total: number;
  balance: number;
  patientName: string;
  createdAt: Date;
}

export interface BillLine {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface BillPayment {
  amount: number;
  method: PaymentMethod;
  receivedAt: Date;
}

export interface BillDetail {
  id: string;
  billNumber: number;
  status: BillStatus;
  patientId: string;
  patientName: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  amountPaid: number;
  balance: number;
  createdAt: Date;
  items: BillLine[];
  payments: BillPayment[];
}

/** Allocate the next gap-free bill number for a clinic (per-clinic advisory lock; see reports). */
async function nextBillNumber(tx: Tx, clinicId: string): Promise<number> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${clinicId + ":bill"}))`);
  const [row] = await tx
    .select({ max: sql<number>`coalesce(max(${bills.billNumber}), 0)` })
    .from(bills)
    .where(eq(bills.clinicId, clinicId));
  return Number(row?.max ?? 0) + 1;
}

/**
 * Create a finalized, itemized bill. Lines snapshot description + unit price; totals are
 * computed server-side, tax from the clinic's `tax_rate`. Bill + items + audit commit in one
 * transaction with a gap-free number.
 */
export async function createBill(
  clinicId: string,
  userId: string,
  input: CreateBillInput,
): Promise<{ id: string; billNumber: number }> {
  if (input.items.length === 0) throw new BillError("A bill needs at least one item.", "empty");

  const clinic = await getClinic(clinicId);
  const taxRate = clinic?.taxRate ?? 0; // basis points

  const lines = input.items.map((i) => ({
    serviceId: i.serviceId,
    description: i.description,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    lineTotal: i.quantity * i.unitPrice,
  }));

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const discount = Math.min(input.discount, subtotal); // never below zero
  const taxBase = Math.max(0, subtotal - discount);
  const tax = Math.round((taxBase * taxRate) / 10_000);
  const total = taxBase + tax;

  return db.transaction(async (tx) => {
    const billNumber = await nextBillNumber(tx, clinicId);
    const [bill] = await tx
      .insert(bills)
      .values({
        clinicId,
        patientId: input.patientId,
        billNumber,
        status: "finalized",
        subtotal,
        discount,
        tax,
        total,
        amountPaid: 0,
        balance: total,
        createdBy: userId,
        finalizedAt: new Date(),
      })
      .returning({ id: bills.id });

    await tx.insert(billItems).values(
      lines.map((l) => ({
        billId: bill.id,
        serviceId: l.serviceId,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        lineTotal: l.lineTotal,
      })),
    );

    await recordAudit(
      { clinicId, userId, action: "bill.create", entityType: "bill", entityId: bill.id, metadata: { billNumber, total } },
      tx,
    );
    return { id: bill.id, billNumber };
  });
}

/**
 * Record a payment against a bill, updating amount paid / balance and flipping status to paid
 * when the balance clears. Payment + bill update + audit commit together.
 */
export async function recordPayment(
  clinicId: string,
  userId: string,
  billId: string,
  input: { amount: number; method: PaymentMethod },
): Promise<void> {
  await db.transaction(async (tx) => {
    // FOR UPDATE locks the bill row so concurrent payments serialise — without it two
    // payments can both read the same amountPaid, both pass the guard, and the second
    // UPDATE overwrites (not adds to) the first, silently losing a payment.
    const [bill] = await tx
      .select({ total: bills.total, amountPaid: bills.amountPaid, status: bills.status })
      .from(bills)
      .where(and(eq(bills.id, billId), eq(bills.clinicId, clinicId)))
      .limit(1)
      .for("update");
    if (!bill) throw new BillError("Bill not found.", "not_found");
    if (bill.status === "cancelled") throw new BillError("Bill is cancelled.", "cancelled");

    const outstanding = bill.total - bill.amountPaid;
    if (outstanding <= 0) throw new BillError("This bill is already settled.", "already_settled");
    if (input.amount > outstanding) {
      throw new BillError("Payment exceeds the outstanding balance.", "exceeds_balance");
    }

    const amountPaid = bill.amountPaid + input.amount;
    const balance = bill.total - amountPaid;

    await tx
      .update(bills)
      .set({ amountPaid, balance, status: balance <= 0 ? "paid" : "finalized" })
      .where(and(eq(bills.id, billId), eq(bills.clinicId, clinicId)));

    await tx.insert(payments).values({
      billId,
      amount: input.amount,
      method: input.method,
      receivedBy: userId,
    });

    await recordAudit(
      { clinicId, userId, action: "payment.create", entityType: "bill", entityId: billId, metadata: { amount: input.amount, method: input.method } },
      tx,
    );
  });
}

/** List bills in a clinic, optionally filtered to one patient. Newest number first. */
export async function listBills(clinicId: string, patientId?: string): Promise<BillListItem[]> {
  const where = patientId
    ? and(eq(bills.clinicId, clinicId), eq(bills.patientId, patientId))
    : eq(bills.clinicId, clinicId);

  return db
    .select({
      id: bills.id,
      billNumber: bills.billNumber,
      status: bills.status,
      total: bills.total,
      balance: bills.balance,
      patientName: patients.fullName,
      createdAt: bills.createdAt,
    })
    .from(bills)
    .innerJoin(patients, eq(bills.patientId, patients.id))
    .where(where)
    .orderBy(desc(bills.billNumber))
    .limit(100);
}

/** Load one bill (tenant-scoped) with items, payments, and patient name. */
export async function getBill(clinicId: string, id: string): Promise<BillDetail | null> {
  const [bill] = await db
    .select({
      id: bills.id,
      billNumber: bills.billNumber,
      status: bills.status,
      patientId: bills.patientId,
      patientName: patients.fullName,
      subtotal: bills.subtotal,
      discount: bills.discount,
      tax: bills.tax,
      total: bills.total,
      amountPaid: bills.amountPaid,
      balance: bills.balance,
      createdAt: bills.createdAt,
    })
    .from(bills)
    .innerJoin(patients, eq(bills.patientId, patients.id))
    .where(and(eq(bills.clinicId, clinicId), eq(bills.id, id)))
    .limit(1);
  if (!bill) return null;

  const items = await db
    .select({
      description: billItems.description,
      quantity: billItems.quantity,
      unitPrice: billItems.unitPrice,
      lineTotal: billItems.lineTotal,
    })
    .from(billItems)
    .where(eq(billItems.billId, id));

  const pays = await db
    .select({ amount: payments.amount, method: payments.method, receivedAt: payments.receivedAt })
    .from(payments)
    .where(eq(payments.billId, id))
    .orderBy(payments.receivedAt);

  return { ...bill, items, payments: pays };
}
