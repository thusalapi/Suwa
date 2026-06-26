import "server-only";
import { and, desc, eq, gt, gte, lt, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bills, billItems, patients, payments } from "@/lib/db/schema";

/** A resolved, inclusive date range (`from`/`to` are YYYY-MM-DD, local clinic time). */
export interface DateRange {
  from: string;
  to: string;
}

export interface ServiceRevenueRow {
  description: string;
  quantity: number;
  amount: number;
}

export interface OutstandingRow {
  id: string;
  billNumber: number;
  patientName: string;
  total: number;
  balance: number;
  createdAt: Date;
}

/** Financial summary over a date range plus the current outstanding-balance list. */
export interface RevenueReport extends DateRange {
  /** Total billed on bills raised in the range (excludes cancelled). */
  billed: number;
  /** Payments received in the range. */
  collected: number;
  /** Number of bills raised in the range. */
  billCount: number;
  /** Per-service totals from snapshotted line items in the range. */
  byService: ServiceRevenueRow[];
  /** Bills with an open balance (current state, not range-bound). */
  outstanding: OutstandingRow[];
}

const n = (v: unknown): number => Number(v ?? 0);
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Midnight (local) at the start of a YYYY-MM-DD day. */
function dayStart(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toISODay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Resolve `from`/`to` query params into a valid inclusive range, defaulting to the current
 * month-to-date. Invalid or reversed inputs fall back to the default.
 */
export function resolveRange(from?: string, to?: string): DateRange {
  const now = new Date();
  const defFrom = toISODay(new Date(now.getFullYear(), now.getMonth(), 1));
  const defTo = toISODay(now);

  const f = from && ISO_DAY.test(from) ? from : defFrom;
  const tval = to && ISO_DAY.test(to) ? to : defTo;
  if (dayStart(f) > dayStart(tval)) return { from: defFrom, to: defTo };
  return { from: f, to: tval };
}

/** Build the revenue report for a clinic over the given (already-validated) range. */
export async function getRevenueReport(clinicId: string, range: DateRange): Promise<RevenueReport> {
  const start = dayStart(range.from);
  const end = new Date(dayStart(range.to).getTime() + 24 * 60 * 60 * 1000); // exclusive

  const rangeBills = and(
    eq(bills.clinicId, clinicId),
    ne(bills.status, "cancelled"),
    gte(bills.createdAt, start),
    lt(bills.createdAt, end),
  );

  const [totals] = await db
    .select({
      billed: sql<string>`coalesce(sum(${bills.total}), 0)`,
      count: sql<string>`count(*)`,
    })
    .from(bills)
    .where(rangeBills);

  const [collectedRow] = await db
    .select({ sum: sql<string>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .innerJoin(bills, eq(payments.billId, bills.id))
    .where(and(eq(bills.clinicId, clinicId), gte(payments.receivedAt, start), lt(payments.receivedAt, end)));

  const byService = await db
    .select({
      description: billItems.description,
      quantity: sql<string>`sum(${billItems.quantity})`,
      amount: sql<string>`sum(${billItems.lineTotal})`,
    })
    .from(billItems)
    .innerJoin(bills, eq(billItems.billId, bills.id))
    .where(rangeBills)
    .groupBy(billItems.description)
    .orderBy(desc(sql`sum(${billItems.lineTotal})`));

  const outstanding = await db
    .select({
      id: bills.id,
      billNumber: bills.billNumber,
      patientName: patients.fullName,
      total: bills.total,
      balance: bills.balance,
      createdAt: bills.createdAt,
    })
    .from(bills)
    .innerJoin(patients, eq(bills.patientId, patients.id))
    .where(and(eq(bills.clinicId, clinicId), gt(bills.balance, 0), ne(bills.status, "cancelled")))
    .orderBy(desc(bills.balance))
    .limit(200);

  return {
    ...range,
    billed: n(totals?.billed),
    collected: n(collectedRow?.sum),
    billCount: n(totals?.count),
    byService: byService.map((r) => ({ description: r.description, quantity: n(r.quantity), amount: n(r.amount) })),
    outstanding,
  };
}
