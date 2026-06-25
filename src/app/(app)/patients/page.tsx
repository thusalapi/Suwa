import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { searchPatients } from "@/lib/patients";
import { SearchBar } from "@/components/molecules/SearchBar";
import { PatientTable } from "@/components/organisms/PatientTable";
import { Button } from "@/components/atoms/Button";
import { getT } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const { q = "" } = await searchParams;
  const locale = DEFAULT_LOCALE;
  const t = getT(locale);

  const patients = await searchPatients(user.clinicId, q);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink">{t("patients.title")}</h1>
        <Link href="/patients/new">
          <Button>{t("patients.add")}</Button>
        </Link>
      </div>

      <SearchBar
        action="/patients"
        defaultValue={q}
        label={t("patients.searchLabel")}
        placeholder={t("patients.searchPlaceholder")}
        submitLabel={t("common.search")}
      />

      <PatientTable
        patients={patients}
        locale={locale}
        emptyMessage={q ? t("patients.noResults") : t("patients.empty")}
      />
    </div>
  );
}
