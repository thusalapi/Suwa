import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";
import { PatientForm } from "../PatientForm";
import { createPatientAction } from "../actions";

export default async function NewPatientPage() {
  await requireUser();
  const locale = DEFAULT_LOCALE;
  const t = getT(locale);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/patients" className="text-sm text-muted hover:text-ink">
          ← {t("patients.title")}
        </Link>
        <h1 className="text-xl font-semibold text-ink">{t("patients.addTitle")}</h1>
      </div>

      <PatientForm locale={locale} action={createPatientAction} submitLabel={t("patients.add")} />
    </div>
  );
}
