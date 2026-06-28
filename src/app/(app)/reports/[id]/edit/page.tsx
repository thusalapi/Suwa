import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getReport } from "@/lib/reports";
import { reportDataToFormInputs } from "@/lib/reports/form";
import { ReportFormRenderer } from "@/components/forms/ReportFormRenderer";
import { getT } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";
import { updateReportAction } from "../../actions";

/**
 * Edit a draft report's data. A verified report is the released artifact, so this redirects
 * back to the read-only view rather than allowing an edit. The frozen snapshot drives the form
 * exactly as it did at creation; only the entered values change (see `updateReport`).
 */
export default async function EditReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const locale = DEFAULT_LOCALE;
  const t = getT(locale);

  const report = await getReport(user.clinicId, id);
  if (!report) notFound();
  if (report.status === "verified") redirect(`/reports/${id}`);

  const { patientInfo, results, values } = reportDataToFormInputs(report.snapshot, report.data);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href={`/reports/${report.id}`} className="text-sm text-muted hover:text-ink">
          ← {report.snapshot.name} #{report.reportNumber}
        </Link>
        <h1 className="text-xl font-semibold text-ink">{t("reports.editTitle")}</h1>
      </div>
      <ReportFormRenderer
        locale={locale}
        snapshot={report.snapshot}
        patientId={report.patientId}
        templateId=""
        patientInfo={patientInfo}
        initialResults={results}
        initialValues={values}
        action={updateReportAction.bind(null, report.id)}
        submitLabel={t("reports.saveChanges")}
      />
    </div>
  );
}
