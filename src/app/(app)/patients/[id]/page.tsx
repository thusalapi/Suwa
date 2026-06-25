import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPatient } from "@/lib/patients";
import { Button } from "@/components/atoms/Button";
import { getT, formatDate } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-sm text-ink">{value || "—"}</dd>
    </div>
  );
}

export default async function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const locale = DEFAULT_LOCALE;
  const t = getT(locale);

  const patient = await getPatient(user.clinicId, id);
  if (!patient) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link href="/patients" className="text-sm text-muted hover:text-ink">
            ← {t("patients.title")}
          </Link>
          <h1 className="text-xl font-semibold text-ink">{patient.fullName}</h1>
          <p className="text-sm text-muted">{patient.phone}</p>
        </div>
        <Link href={`/patients/${patient.id}/edit`}>
          <Button variant="secondary">{t("patients.edit")}</Button>
        </Link>
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-surface-raised p-4 sm:grid-cols-3">
        <Detail label={t("patients.nic")} value={patient.nic ?? ""} />
        <Detail
          label={t("patients.gender")}
          value={patient.gender ? t(`patients.gender_${patient.gender}`) : ""}
        />
        <Detail label={t("patients.dob")} value={patient.dob ? formatDate(patient.dob, locale) : ""} />
        <Detail label={t("patients.address")} value={patient.address ?? ""} />
        <Detail label={t("patients.notes")} value={patient.notes ?? ""} />
        <Detail label={t("patients.registered")} value={formatDate(patient.createdAt, locale)} />
      </dl>

      {/* History — wired up in later stages (bills: Stage 3, reports: Stage 2). */}
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface-raised p-4">
          <h2 className="mb-2 text-sm font-semibold text-ink">{t("patients.bills")}</h2>
          <p className="text-sm text-muted">{t("patients.historyComingSoon")}</p>
        </section>
        <section className="rounded-lg border border-border bg-surface-raised p-4">
          <h2 className="mb-2 text-sm font-semibold text-ink">{t("patients.reports")}</h2>
          <p className="text-sm text-muted">{t("patients.historyComingSoon")}</p>
        </section>
      </div>
    </div>
  );
}
