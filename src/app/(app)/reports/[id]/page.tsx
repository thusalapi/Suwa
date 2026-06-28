import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getReport } from "@/lib/reports";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { ReportView } from "@/components/organisms/ReportView";
import { getT, formatDate } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";
import { verifyReportAction } from "../actions";

const statusTone = { draft: "neutral", finalized: "neutral", verified: "success" } as const;

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const locale = DEFAULT_LOCALE;
  const t = getT(locale);

  const report = await getReport(user.clinicId, id);
  if (!report) notFound();

  const canVerify = (user.role === "doctor" || user.role === "owner") && report.status !== "verified";
  const canEdit = report.status !== "verified"; // any clinic role may edit a draft

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link href={`/patients/${report.patientId}`} className="text-sm text-muted hover:text-ink">
            ← {report.patientName}
          </Link>
          <h1 className="text-xl font-semibold text-ink">
            {report.snapshot.name} <span className="text-muted">#{report.reportNumber}</span>
          </h1>
          <div className="flex items-center gap-2 text-sm text-muted">
            <Badge tone={statusTone[report.status]}>{t(`reports.status_${report.status}`)}</Badge>
            {report.status === "verified" && report.verifiedByName ? (
              <span>
                {t("reports.verifiedBy", { name: report.verifiedByName })}
                {report.verifiedAt ? ` · ${formatDate(report.verifiedAt, locale)}` : ""}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a href={`/reports/${report.id}/pdf`} target="_blank" rel="noopener noreferrer">
            <Button variant="secondary">{t("reports.downloadPdf")}</Button>
          </a>
          {canEdit ? (
            <Link href={`/reports/${report.id}/edit`}>
              <Button variant="secondary">{t("reports.edit")}</Button>
            </Link>
          ) : null}
          {canVerify ? (
            <form action={verifyReportAction}>
              <input type="hidden" name="id" value={report.id} />
              <Button type="submit">{t("reports.verify")}</Button>
            </form>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface-raised p-6">
        <ReportView locale={locale} snapshot={report.snapshot} data={report.data} />
      </div>
    </div>
  );
}
