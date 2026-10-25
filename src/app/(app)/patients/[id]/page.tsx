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
import { PageTitle, SectionTitle } from "@/components/atoms/Heading";
import { ageFromDob } from "@/lib/utils/age";
import { groupVisits, localDay } from "@/lib/visits";

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
  const age = ageFromDob(patient.dob);

  const [reports, bills] = await Promise.all([
    listReports(user.clinicId, patient.id),
    listBills(user.clinicId, patient.id),
  ]);
  const visits = groupVisits(reports, bills);
  const today = localDay(new Date());

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link href="/patients" className="text-sm text-muted hover:text-ink">
            ← {t("patients.title")}
          </Link>
          <PageTitle>{patient.fullName}</PageTitle>
          <p className="text-sm text-muted">{patient.phone}</p>
        </div>
        <Link href={`/patients/${patient.id}/edit`}>
          <Button variant="secondary">{t("patients.edit")}</Button>
        </Link>
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-surface-raised p-4 sm:grid-cols-3">
        <Detail label={t("patients.nic")} value={patient.nic ?? ""} />
        <Detail label={t("patients.gender")} value={patient.gender ? t(`patients.gender_${patient.gender}`) : ""} />
        <Detail
          label={t("patients.dob")}
          value={patient.dob && !patient.dobEstimated ? formatDate(patient.dob, locale) : ""}
        />
        <Detail
          label={t("patients.age")}
          value={
            age != null
              ? `${t("patients.ageYears", { n: age })}${patient.dobEstimated ? ` ${t("patients.ageEstimated")}` : ""}`
              : ""
          }
        />
        <Detail label={t("patients.address")} value={patient.address ?? ""} />
        <Detail label={t("patients.notes")} value={patient.notes ?? ""} />
        <Detail label={t("patients.registered")} value={formatDate(patient.createdAt, locale)} />
      </dl>

      {/* Visits — the patient's reports and bills grouped by the day they came in, newest first. */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>{t("patients.visits")}</SectionTitle>
          <div className="flex gap-2">
            <Link href={`/reports/new?patientId=${patient.id}`}>
              <Button variant="secondary" size="sm">
                {t("patients.newReport")}
              </Button>
            </Link>
            <Link href={`/bills/new?patientId=${patient.id}`}>
              <Button variant="secondary" size="sm">
                {t("patients.newBill")}
              </Button>
            </Link>
          </div>
        </div>

        {visits.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface-raised px-4 py-6 text-center text-sm text-muted">
            {t("patients.noVisits")}
          </p>
        ) : (
          <ol className="space-y-3">
            {visits.map((v) => (
              <li key={v.date} className="rounded-lg border border-border bg-surface-raised">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-2.5">
                  <h3 className="font-semibold text-ink">
                    {formatDate(v.date, locale)}
                    {v.date === today ? (
                      <Badge tone="success" className="ml-2 align-middle">
                        {t("patients.visitToday")}
                      </Badge>
                    ) : null}
                  </h3>
                  <p className="text-xs text-muted">
                    {t("patients.visitSummary", { reports: v.reports.length, bills: v.bills.length })}
                    {v.bills.length ? (
                      <>
                        {" · "}
                        {t("patients.visitBilled", { amount: formatMoney(v.billed, locale) })}
                        {v.outstanding > 0 ? (
                          <span className="font-medium text-danger">
                            {" · "}
                            {t("patients.visitDue", { amount: formatMoney(v.outstanding, locale) })}
                          </span>
                        ) : null}
                      </>
                    ) : null}
                  </p>
                </div>

                <div className="grid gap-x-6 px-4 py-2 sm:grid-cols-2">
                  <div>
                    <p className="pt-1 text-xs font-medium uppercase tracking-wide text-muted">
                      {t("patients.reports")}
                    </p>
                    {v.reports.length === 0 ? (
                      <p className="py-2 text-sm text-muted">—</p>
                    ) : (
                      <ul className="divide-y divide-border text-sm">
                        {v.reports.map((r) => (
                          <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                            <Link href={`/reports/${r.id}`} className="text-primary-dark hover:underline">
                              #{r.reportNumber} · {r.templateName}
                            </Link>
                            <Badge tone={statusTone[r.status]}>{t(`reports.status_${r.status}`)}</Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="pt-1 text-xs font-medium uppercase tracking-wide text-muted">{t("patients.bills")}</p>
                    {v.bills.length === 0 ? (
                      <p className="py-2 text-sm text-muted">—</p>
                    ) : (
                      <ul className="divide-y divide-border text-sm">
                        {v.bills.map((b) => (
                          <li key={b.id} className="flex items-center justify-between gap-2 py-2">
                            <Link href={`/bills/${b.id}`} className="text-primary-dark hover:underline">
                              #{b.billNumber} · {formatMoney(b.total, locale)}
                            </Link>
                            <Badge tone={billTone[b.status]}>{t(`bills.status_${b.status}`)}</Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
