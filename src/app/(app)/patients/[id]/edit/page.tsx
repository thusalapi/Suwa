import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPatient } from "@/lib/patients";
import { getT } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";
import { PatientForm } from "../../PatientForm";
import { updatePatientAction } from "../../actions";

export default async function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const locale = DEFAULT_LOCALE;
  const t = getT(locale);

  const patient = await getPatient(user.clinicId, id);
  if (!patient) notFound();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href={`/patients/${patient.id}`} className="text-sm text-muted hover:text-ink">
          ← {patient.fullName}
        </Link>
        <h1 className="text-xl font-semibold text-ink">{t("patients.editTitle")}</h1>
      </div>

      <PatientForm
        locale={locale}
        action={updatePatientAction}
        patientId={patient.id}
        submitLabel={t("common.save")}
        initial={{
          fullName: patient.fullName,
          phone: patient.phone,
          nic: patient.nic ?? "",
          gender: patient.gender ?? "",
          dob: patient.dob ?? "",
          address: patient.address ?? "",
          notes: patient.notes ?? "",
        }}
      />
    </div>
  );
}
