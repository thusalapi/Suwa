import "server-only";
import { and, eq, gt, gte, lt, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bills, payments, reports } from "@/lib/db/schema";

/** Snapshot for the owner dashboard. All money values are integer minor units. */
export interface DashboardStats {
  /** Payments received today (cash collected). */
  revenueToday: number;
  /** Number of bills raised today (excludes cancelled). */
  billsToday: number;
  /** Total billed today (excludes cancelled). */
  billedToday: number;
  /** Reports not yet verified (draft + finalized). */
  pendingReports: number;
  /** Sum of open balances across all uncancelled bills. */
  outstandingBalance: number;
  /** Number of bills with an open balance. */
  outstandingCount: number;
}

const n = (v: unknown): number => Number(v ?? 0);

/** Start of today / start of tomorrow in the server's local time (the clinic PC's clock). */
function todayBounds(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/** Aggregate today's figures and current outstanding totals for one clinic. */
export async function getDashboardStats(clinicId: string): Promise<DashboardStats> {
  const { start, end } = todayBounds();

  const [revenue] = await db
    .select({ sum: sql<string>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .innerJoin(bills, eq(payments.billId, bills.id))
    .where(and(eq(bills.clinicId, clinicId), gte(payments.receivedAt, start), lt(payments.receivedAt, end)));

  const [today] = await db
    .select({
      count: sql<string>`count(*)`,
      billed: sql<string>`coalesce(sum(${bills.total}), 0)`,
    })
    .from(bills)
    .where(
      and(
        eq(bills.clinicId, clinicId),
        ne(bills.status, "cancelled"),
        gte(bills.createdAt, start),
        lt(bills.createdAt, end),
      ),
    );

  const [pending] = await db
    .select({ count: sql<string>`count(*)` })
    .from(reports)
    .where(and(eq(reports.clinicId, clinicId), ne(reports.status, "verified")));

  const [outstanding] = await db
    .select({
      sum: sql<string>`coalesce(sum(${bills.balance}), 0)`,
      count: sql<string>`count(*)`,
    })
    .from(bills)
    .where(and(eq(bills.clinicId, clinicId), gt(bills.balance, 0), ne(bills.status, "cancelled")));

  return {
    revenueToday: n(revenue?.sum),
    billsToday: n(today?.count),
    billedToday: n(today?.billed),
    pendingReports: n(pending?.count),
    outstandingBalance: n(outstanding?.sum),
    outstandingCount: n(outstanding?.count),
  };
}
