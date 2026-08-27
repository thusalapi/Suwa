import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPatient, searchPatients } from "@/lib/patients";
import { listServices } from "@/lib/catalog";
import { getClinic } from "@/lib/clinic";
import { PatientFinder } from "@/components/organisms/PatientFinder";
import { getT } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";
import { BillForm } from "../BillForm";

export default async function NewBillPage({ searchParams }: { searchParams: Promise<{ patientId?: string }> }) {
  const user = await requireUser();
  const { patientId } = await searchParams;
  const locale = DEFAULT_LOCALE;
  const t = getT(locale);

  // No patient yet → show the fast finder (pick → bill in one click) instead of bouncing away.
  if (!patientId) {
    const recent = await searchPatients(user.clinicId, "");
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-ink">{t("bills.newTitle")}</h1>
          <p className="text-sm text-muted">{t("bills.pickPatient")}</p>
        </div>
        <PatientFinder locale={locale} initialQuery="" initialResults={recent} mode="bill" />
      </div>
    );
  }

  const patient = await getPatient(user.clinicId, patientId);
  if (!patient) notFound();

  const [services, clinic] = await Promise.all([listServices(user.clinicId, true), getClinic(user.clinicId)]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href={`/patients/${patient.id}`} className="text-sm text-muted hover:text-ink">
          ← {patient.fullName}
        </Link>
        <h1 className="text-xl font-semibold text-ink">{t("bills.newTitle")}</h1>
      </div>

      <BillForm
        locale={locale}
        patientId={patient.id}
        taxRate={clinic?.taxRate ?? 0}
        services={services.map((s) => ({ id: s.id, name: s.name, defaultPrice: s.defaultPrice }))}
        submitLabel={t("bills.create")}
      />
    </div>
  );
}
