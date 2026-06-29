import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { searchPatients } from "@/lib/patients";
import { PatientFinder } from "@/components/organisms/PatientFinder";
import { Button } from "@/components/atoms/Button";
import { getT } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";

export default async function PatientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q = "" } = await searchParams;
  const locale = DEFAULT_LOCALE;
  const t = getT(locale);

  const patients = await searchPatients(user.clinicId, q);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-ink">{t("patients.title")}</h1>
          <p className="text-sm text-muted">{t("patients.findHint")}</p>
        </div>
        <Link href="/patients/new">
          <Button>{t("patients.add")}</Button>
        </Link>
      </div>

      <PatientFinder locale={locale} initialQuery={q} initialResults={patients} mode="all" />
    </div>
  );
}
