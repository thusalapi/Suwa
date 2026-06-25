import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listReports } from "@/lib/reports";
import { Badge } from "@/components/atoms/Badge";
import { getT, formatDate } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";

const statusTone = { draft: "neutral", finalized: "neutral", verified: "success" } as const;

export default async function ReportsPage() {
  const user = await requireUser();
  const t = getT(DEFAULT_LOCALE);
  const reports = await listReports(user.clinicId);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-ink">{t("reports.title")}</h1>

      {reports.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface-raised px-4 py-8 text-center text-sm text-muted">
          {t("reports.empty")}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface-raised">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-2 font-medium">{t("reports.number")}</th>
                <th className="px-4 py-2 font-medium">{t("reports.patient")}</th>
                <th className="px-4 py-2 font-medium">{t("reports.template")}</th>
                <th className="px-4 py-2 font-medium">{t("reports.status")}</th>
                <th className="px-4 py-2 font-medium">{t("reports.created")}</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface">
                  <td className="px-4 py-2">
                    <Link href={`/reports/${r.id}`} className="font-medium text-primary-dark hover:underline">
                      #{r.reportNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-ink">{r.patientName}</td>
                  <td className="px-4 py-2 text-muted">{r.templateName}</td>
                  <td className="px-4 py-2">
                    <Badge tone={statusTone[r.status]}>{t(`reports.status_${r.status}`)}</Badge>
                  </td>
                  <td className="px-4 py-2 text-muted">{formatDate(r.createdAt, DEFAULT_LOCALE)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
