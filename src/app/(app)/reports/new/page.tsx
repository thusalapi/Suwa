import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPatient } from "@/lib/patients";
import { listTemplates, getTemplate } from "@/lib/report-templates";
import { ReportFormRenderer } from "@/components/forms/ReportFormRenderer";
import { getT } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";
import { createReportAction } from "../actions";

/** Whole years between dob and today, as a string for the patient_info prefill. */
function ageFromDob(dob: string | null): string {
  if (!dob) return "";
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 ? String(age) : "";
}

export default async function NewReportPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string; templateId?: string }>;
}) {
  const user = await requireUser();
  const { patientId, templateId } = await searchParams;
  const locale = DEFAULT_LOCALE;
  const t = getT(locale);

  if (!patientId) redirect("/patients");

  const patient = await getPatient(user.clinicId, patientId);
  if (!patient) notFound();

  const templates = (await listTemplates(user.clinicId)).filter((tpl) => tpl.active);
  const selected = templateId ? await getTemplate(user.clinicId, templateId) : null;

  const header = (
    <div className="space-y-1">
      <Link href={`/patients/${patient.id}`} className="text-sm text-muted hover:text-ink">
        ← {patient.fullName}
      </Link>
      <h1 className="text-xl font-semibold text-ink">{t("reports.newTitle")}</h1>
    </div>
  );

  // Step 1: pick a template.
  if (!selected || !selected.active) {
    return (
      <div className="space-y-6">
        {header}
        <p className="text-sm text-muted">{t("reports.chooseTemplate")}</p>
        {templates.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface-raised px-4 py-8 text-center text-sm text-muted">
            {t("reports.noTemplates")}
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {templates.map((tpl) => (
              <li key={tpl.id}>
                <Link
                  href={`/reports/new?patientId=${patient.id}&templateId=${tpl.id}`}
                  className="block rounded-lg border border-border bg-surface-raised p-4 hover:bg-surface"
                >
                  <span className="font-medium text-ink">{tpl.name}</span>
                  <span className="block text-xs text-muted">v{tpl.version}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // Step 2: render the data-entry form for the chosen template.
  const patientInfo: Record<string, string> = {
    name: patient.fullName,
    gender: patient.gender ?? "",
    age: ageFromDob(patient.dob),
    ref_doctor: "",
  };

  return (
    <div className="space-y-6">
      {header}
      <p className="text-sm text-muted">
        {selected.name} <span className="text-muted">v{selected.version}</span>
      </p>
      <ReportFormRenderer
        locale={locale}
        snapshot={selected.schema}
        patientId={patient.id}
        templateId={selected.id}
        patientInfo={patientInfo}
        action={createReportAction}
        submitLabel={t("reports.create")}
      />
    </div>
  );
}
