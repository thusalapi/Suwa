import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPatient } from "@/lib/patients";
import { listReports } from "@/lib/reports";
import { listBills } from "@/lib/bills";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { getT, formatDate, formatMoney } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";

const statusTone = { draft: "neutral", finalized: "neutral", verified: "success" } as const;
const billTone = { draft: "neutral", finalized: "neutral", paid: "success", cancelled: "danger" } as const;

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

  const [reports, bills] = await Promise.all([
    listReports(user.clinicId, patient.id),
    listBills(user.clinicId, patient.id),
  ]);

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
        <Detail label={t("patients.gender")} value={patient.gender ? t(`patients.gender_${patient.gender}`) : ""} />
        <Detail label={t("patients.dob")} value={patient.dob ? formatDate(patient.dob, locale) : ""} />
        <Detail label={t("patients.address")} value={patient.address ?? ""} />
        <Detail label={t("patients.notes")} value={patient.notes ?? ""} />
        <Detail label={t("patients.registered")} value={formatDate(patient.createdAt, locale)} />
      </dl>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Reports — wired to the report engine (Stage 2). */}
        <section className="rounded-lg border border-border bg-surface-raised p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">{t("patients.reports")}</h2>
            <Link href={`/reports/new?patientId=${patient.id}`}>
              <Button variant="secondary" size="sm">
                {t("patients.newReport")}
              </Button>
            </Link>
          </div>
          {reports.length === 0 ? (
            <p className="text-sm text-muted">{t("patients.noReports")}</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {reports.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2">
                  <Link href={`/reports/${r.id}`} className="text-primary-dark hover:underline">
                    #{r.reportNumber} · {r.templateName}
                  </Link>
                  <Badge tone={statusTone[r.status]}>{t(`reports.status_${r.status}`)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Bills — wired to billing (Stage 3). */}
        <section className="rounded-lg border border-border bg-surface-raised p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">{t("patients.bills")}</h2>
            <Link href={`/bills/new?patientId=${patient.id}`}>
              <Button variant="secondary" size="sm">
                {t("patients.newBill")}
              </Button>
            </Link>
          </div>
          {bills.length === 0 ? (
            <p className="text-sm text-muted">{t("patients.noBills")}</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {bills.map((b) => (
                <li key={b.id} className="flex items-center justify-between py-2">
                  <Link href={`/bills/${b.id}`} className="text-primary-dark hover:underline">
                    #{b.billNumber} · {formatMoney(b.total, DEFAULT_LOCALE)}
                  </Link>
                  <Badge tone={billTone[b.status]}>{t(`bills.status_${b.status}`)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
