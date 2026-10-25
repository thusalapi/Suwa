/**
 * Visits: a patient's reports and bills grouped by the day they came in. A visit is derived, not
 * stored — no extra step for staff, and every existing report and bill groups correctly.
 *
 * - A report belongs to the day of its specimen "Date & Time" (when the sample was taken), falling
 *   back to the day the report was created — so results finished the next day stay with the visit.
 * - A bill belongs to the day it was made.
 *
 * Days are on the clinic's clock (APP_TIMEZONE), as "YYYY-MM-DD".
 */

import { zonedDay } from "@/lib/time";

export interface VisitReport {
  id: string;
  createdAt: Date;
  /** The report's specimen Date & Time as entered ("2026-10-24T11:16"), if any. */
  specimenAt?: string | null;
}

export interface VisitBill {
  id: string;
  createdAt: Date;
  status: string;
  total: number;
  balance: number;
}

export interface Visit<R extends VisitReport, B extends VisitBill> {
  /** "YYYY-MM-DD" on the local clock. */
  date: string;
  reports: R[];
  bills: B[];
  /** Sum of the day's bill totals (cancelled bills excluded), in minor units. */
  billed: number;
  /** Sum of what is still owed on the day's bills, in minor units. */
  outstanding: number;
}

/** A Date as "YYYY-MM-DD" on the clinic's clock (APP_TIMEZONE). */
export function localDay(d: Date): string {
  return zonedDay(d);
}

/** The visit day of a report: its specimen date when entered, else the day it was created. */
export function reportVisitDay(r: VisitReport): string {
  const m = r.specimenAt?.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : localDay(r.createdAt);
}

/** Group a patient's reports and bills into visits, newest day first. */
export function groupVisits<R extends VisitReport, B extends VisitBill>(reports: R[], bills: B[]): Visit<R, B>[] {
  const byDay = new Map<string, Visit<R, B>>();
  const visit = (date: string) => {
    let v = byDay.get(date);
    if (!v) {
      v = { date, reports: [], bills: [], billed: 0, outstanding: 0 };
      byDay.set(date, v);
    }
    return v;
  };

  for (const r of reports) visit(reportVisitDay(r)).reports.push(r);
  for (const b of bills) {
    const v = visit(localDay(b.createdAt));
    v.bills.push(b);
    if (b.status !== "cancelled") {
      v.billed += b.total;
      v.outstanding += b.balance;
    }
  }

  return [...byDay.values()].sort((a, b) => b.date.localeCompare(a.date));
}
