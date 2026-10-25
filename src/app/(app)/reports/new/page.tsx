import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPatient, searchPatients } from "@/lib/patients";
import { listTemplates, getTemplate } from "@/lib/report-templates";
import { ReportFormRenderer } from "@/components/forms/ReportFormRenderer";
import { PatientFinder } from "@/components/organisms/PatientFinder";
import { getT, nowForDateTimeInput } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";
import { createReportAction } from "../actions";
import { PageTitle } from "@/components/atoms/Heading";
import { ageFromDob } from "@/lib/utils/age";
import { TemplatePicker } from "./TemplatePicker";

export default async function NewReportPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string; templateId?: string }>;
}) {
  const user = await requireUser();
  const { patientId, templateId } = await searchParams;
  const locale = DEFAULT_LOCALE;
  const t = getT(locale);

  // No patient yet → show the fast finder (pick → report in one click) instead of bouncing away.
  if (!patientId) {
    const recent = await searchPatients(user.clinicId, "");
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <PageTitle>{t("reports.newTitle")}</PageTitle>
          <p className="text-sm text-muted">{t("reports.pickPatient")}</p>
        </div>
        <PatientFinder locale={locale} initialQuery="" initialResults={recent} mode="report" />
      </div>
    );
  }

  const patient = await getPatient(user.clinicId, patientId);
  if (!patient) notFound();

  const templates = (await listTemplates(user.clinicId)).filter((tpl) => tpl.active);

  // One report type → skip the picker entirely and go straight to the form.
  if (!templateId && templates.length === 1) {
    redirect(`/reports/new?patientId=${patient.id}&templateId=${templates[0].id}`);
  }

  const selected = templateId ? await getTemplate(user.clinicId, templateId) : null;

  const header = (
    <div className="space-y-1">
      <Link href={`/patients/${patient.id}`} className="text-sm text-muted hover:text-ink">
        ← {patient.fullName}
      </Link>
      <PageTitle>{t("reports.newTitle")}</PageTitle>
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
          <TemplatePicker
            locale={locale}
            patientId={patient.id}
            templates={templates.map(({ id, name, version, aliases }) => ({ id, name, version, aliases }))}
          />
        )}
      </div>
    );
  }

  // Step 2: render the data-entry form for the chosen template.
  const patientInfo: Record<string, string> = {
    name: patient.fullName,
    gender: patient.gender ?? "",
    age: String(ageFromDob(patient.dob) ?? ""),
    ref_doctor: "",
    // Prefilled with the current time; staff can still change it (e.g. sample collected earlier).
    datetime: nowForDateTimeInput(),
    // The template's specimen (e.g. "Urine"), else "Blood" — the lab's usual; ignored if unused.
    source: selected.schema.sections.find((s) => s.type === "patient_info")?.defaultSource ?? "Blood",
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
