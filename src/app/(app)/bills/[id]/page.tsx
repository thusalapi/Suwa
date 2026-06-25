import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getBill } from "@/lib/bills";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { getT, formatMoney, formatDate } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";
import { PaymentForm } from "../PaymentForm";

const statusTone = { draft: "neutral", finalized: "neutral", paid: "success", cancelled: "danger" } as const;

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex w-64 items-center justify-between ${strong ? "border-t border-border pt-1 font-semibold" : ""}`}>
      <span className={strong ? "text-ink" : "text-muted"}>{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}

export default async function BillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const locale = DEFAULT_LOCALE;
  const t = getT(locale);

  const bill = await getBill(user.clinicId, id);
  if (!bill) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link href={`/patients/${bill.patientId}`} className="text-sm text-muted hover:text-ink">
            ← {bill.patientName}
          </Link>
          <h1 className="text-xl font-semibold text-ink">
            {t("bills.title")} <span className="text-muted">#{bill.billNumber}</span>
          </h1>
          <div className="flex items-center gap-2 text-sm text-muted">
            <Badge tone={statusTone[bill.status]}>{t(`bills.status_${bill.status}`)}</Badge>
            <span>{formatDate(bill.createdAt, locale)}</span>
          </div>
        </div>
        <a href={`/bills/${bill.id}/pdf`} target="_blank" rel="noopener noreferrer">
          <Button variant="secondary">{t("bills.downloadPdf")}</Button>
        </a>
      </div>

      {/* Line items */}
      <div className="overflow-hidden rounded-lg border border-border bg-surface-raised">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="px-4 py-2 font-medium">{t("bills.description")}</th>
              <th className="px-4 py-2 font-medium">{t("bills.qty")}</th>
              <th className="px-4 py-2 font-medium">{t("bills.unitPrice")}</th>
              <th className="px-4 py-2 font-medium">{t("bills.lineTotal")}</th>
            </tr>
          </thead>
          <tbody>
            {bill.items.map((it, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-4 py-2 text-ink">{it.description}</td>
                <td className="px-4 py-2 text-muted">{it.quantity}</td>
                <td className="px-4 py-2 text-muted">{formatMoney(it.unitPrice, locale)}</td>
                <td className="px-4 py-2 text-ink">{formatMoney(it.lineTotal, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex flex-col items-end gap-1 text-sm">
        <TotalRow label={t("bills.subtotal")} value={formatMoney(bill.subtotal, locale)} />
        <TotalRow label={t("bills.discount")} value={formatMoney(bill.discount, locale)} />
        <TotalRow label={t("bills.taxLabel")} value={formatMoney(bill.tax, locale)} />
        <TotalRow label={t("bills.total")} value={formatMoney(bill.total, locale)} strong />
        <TotalRow label={t("bills.paid")} value={formatMoney(bill.amountPaid, locale)} />
        <TotalRow label={t("bills.balance")} value={formatMoney(bill.balance, locale)} strong />
      </div>

      {/* Payments */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">{t("bills.payments")}</h2>
        {bill.payments.length === 0 ? (
          <p className="text-sm text-muted">{t("bills.noPayments")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface-raised text-sm">
            {bill.payments.map((p, i) => (
              <li key={i} className="flex items-center justify-between px-4 py-2">
                <span className="text-ink">{formatMoney(p.amount, locale)}</span>
                <span className="text-muted">{t(`bills.method_${p.method}`)}</span>
                <span className="text-muted">{formatDate(p.receivedAt, locale)}</span>
              </li>
            ))}
          </ul>
        )}

        {bill.status !== "paid" && bill.status !== "cancelled" ? (
          <div className="rounded-lg border border-border bg-surface-raised p-4">
            <PaymentForm locale={locale} billId={bill.id} />
          </div>
        ) : null}
      </section>
    </div>
  );
}
