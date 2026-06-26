import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getRevenueReport, resolveRange } from "@/lib/analytics";
import { StatCard } from "@/components/molecules/StatCard";
import { Input } from "@/components/atoms/Input";
import { Label } from "@/components/atoms/Label";
import { Button } from "@/components/atoms/Button";
import { getT, formatMoney, formatDate } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";

export default async function RevenuePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await requireRole("owner");
  const t = getT(DEFAULT_LOCALE);
  const money = (v: number) => formatMoney(v, DEFAULT_LOCALE);

  const { from, to } = await searchParams;
  const range = resolveRange(from, to);
  const report = await getRevenueReport(user.clinicId, range);

  const query = `from=${range.from}&to=${range.to}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-ink">{t("revenue.title")}</h1>
          <p className="text-sm text-muted">{t("revenue.subtitle")}</p>
        </div>
        <div className="flex gap-3">
          <Link href={`/revenue/csv?${query}`}>
            <Button variant="secondary">{t("revenue.exportCsv")}</Button>
          </Link>
          <Link href={`/revenue/pdf?${query}`} target="_blank">
            <Button variant="secondary">{t("revenue.exportPdf")}</Button>
          </Link>
        </div>
      </div>

      <form method="get" action="/revenue" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="from">{t("revenue.from")}</Label>
          <Input id="from" name="from" type="date" defaultValue={range.from} className="w-44" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to">{t("revenue.to")}</Label>
          <Input id="to" name="to" type="date" defaultValue={range.to} className="w-44" />
        </div>
        <Button type="submit">{t("revenue.apply")}</Button>
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("revenue.billed")} value={money(report.billed)} />
        <StatCard label={t("revenue.collected")} value={money(report.collected)} />
        <StatCard label={t("revenue.billCount")} value={report.billCount} />
        <StatCard label={t("revenue.outstandingTotal")} value={money(report.outstandingTotal)} />
      </div>

      {/* Revenue by service */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">{t("revenue.byService")}</h2>
        {report.byService.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface-raised px-4 py-8 text-center text-sm text-muted">
            {t("revenue.noService")}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface-raised">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="px-4 py-2 font-medium">{t("revenue.service")}</th>
                  <th className="px-4 py-2 text-right font-medium">{t("revenue.qty")}</th>
                  <th className="px-4 py-2 text-right font-medium">{t("revenue.amount")}</th>
                </tr>
              </thead>
              <tbody>
                {report.byService.map((s) => (
                  <tr key={s.description} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 text-ink">{s.description}</td>
                    <td className="px-4 py-2 text-right text-muted">{s.quantity}</td>
                    <td className="px-4 py-2 text-right text-ink">{money(s.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Outstanding payments */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">{t("revenue.outstanding")}</h2>
        {report.outstanding.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface-raised px-4 py-8 text-center text-sm text-muted">
            {t("revenue.noOutstanding")}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface-raised">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="px-4 py-2 font-medium">{t("revenue.number")}</th>
                  <th className="px-4 py-2 font-medium">{t("revenue.patient")}</th>
                  <th className="px-4 py-2 text-right font-medium">{t("revenue.total")}</th>
                  <th className="px-4 py-2 text-right font-medium">{t("revenue.balance")}</th>
                  <th className="px-4 py-2 font-medium">{t("revenue.created")}</th>
                </tr>
              </thead>
              <tbody>
                {report.outstanding.map((o) => (
                  <tr key={o.id} className="border-b border-border last:border-0 hover:bg-surface">
                    <td className="px-4 py-2">
                      <Link href={`/bills/${o.id}`} className="font-medium text-primary-dark hover:underline">
                        #{o.billNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-ink">{o.patientName}</td>
                    <td className="px-4 py-2 text-right text-ink">{money(o.total)}</td>
                    <td className="px-4 py-2 text-right text-ink">{money(o.balance)}</td>
                    <td className="px-4 py-2 text-muted">{formatDate(o.createdAt, DEFAULT_LOCALE)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
