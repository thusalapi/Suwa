import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listBills } from "@/lib/bills";
import { Badge } from "@/components/atoms/Badge";
import { getT, formatMoney, formatDate } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";

const statusTone = { draft: "neutral", finalized: "neutral", paid: "success", cancelled: "danger" } as const;

export default async function BillsPage() {
  const user = await requireUser();
  const t = getT(DEFAULT_LOCALE);
  const bills = await listBills(user.clinicId);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-ink">{t("bills.title")}</h1>

      {bills.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface-raised px-4 py-8 text-center text-sm text-muted">
          {t("bills.empty")}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface-raised">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-2 font-medium">{t("bills.number")}</th>
                <th className="px-4 py-2 font-medium">{t("bills.patient")}</th>
                <th className="px-4 py-2 font-medium">{t("bills.total")}</th>
                <th className="px-4 py-2 font-medium">{t("bills.balance")}</th>
                <th className="px-4 py-2 font-medium">{t("bills.status")}</th>
                <th className="px-4 py-2 font-medium">{t("bills.created")}</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => (
                <tr key={b.id} className="border-b border-border last:border-0 hover:bg-surface">
                  <td className="px-4 py-2">
                    <Link href={`/bills/${b.id}`} className="font-medium text-primary-dark hover:underline">
                      #{b.billNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-ink">{b.patientName}</td>
                  <td className="px-4 py-2 text-ink">{formatMoney(b.total, DEFAULT_LOCALE)}</td>
                  <td className="px-4 py-2 text-muted">{formatMoney(b.balance, DEFAULT_LOCALE)}</td>
                  <td className="px-4 py-2">
                    <Badge tone={statusTone[b.status]}>{t(`bills.status_${b.status}`)}</Badge>
                  </td>
                  <td className="px-4 py-2 text-muted">{formatDate(b.createdAt, DEFAULT_LOCALE)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
