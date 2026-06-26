import { getCurrentUser } from "@/lib/auth";
import { getRevenueReport, resolveRange } from "@/lib/analytics";
import { formatDate } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";

/** Escape a CSV cell: wrap in quotes and double any embedded quotes. */
function cell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Money columns are exported as plain decimal (minor units → major) for spreadsheet maths. */
const major = (v: number) => (v / 100).toFixed(2);

/** Revenue report as CSV. Owner-only Route Handler; respects ?from=&to=. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (user.role !== "owner") return new Response("Forbidden", { status: 403 });

  const url = new URL(req.url);
  const range = resolveRange(url.searchParams.get("from") ?? undefined, url.searchParams.get("to") ?? undefined);
  const report = await getRevenueReport(user.clinicId, range);
  const outstandingTotal = report.outstandingTotal;

  const lines: string[] = [];
  lines.push(`Revenue report,${range.from} to ${range.to}`);
  lines.push("");
  lines.push("Summary,Amount");
  lines.push(`Billed,${major(report.billed)}`);
  lines.push(`Collected,${major(report.collected)}`);
  lines.push(`Bills,${report.billCount}`);
  lines.push(`Outstanding,${major(outstandingTotal)}`);
  lines.push("");
  lines.push("Revenue by service");
  lines.push("Service,Qty,Amount");
  for (const s of report.byService) {
    lines.push([cell(s.description), s.quantity, major(s.amount)].join(","));
  }
  lines.push("");
  lines.push("Outstanding payments");
  lines.push("Bill,Patient,Total,Balance,Created");
  for (const o of report.outstanding) {
    lines.push(
      [
        `#${o.billNumber}`,
        cell(o.patientName),
        major(o.total),
        major(o.balance),
        cell(formatDate(o.createdAt, DEFAULT_LOCALE)),
      ].join(","),
    );
  }

  const csv = "﻿" + lines.join("\r\n"); // BOM so Excel reads UTF-8

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="revenue-${range.from}_${range.to}.csv"`,
    },
  });
}
