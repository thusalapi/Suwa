import Link from "next/link";
import type { PatientListItem } from "@/lib/patients";
import { getT } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/types";

export interface PatientTableProps {
  patients: PatientListItem[];
  locale: Locale;
  /** Shown when the list is empty (e.g. no results / no patients yet). */
  emptyMessage: string;
}

/** Feature table of patients; each row links to the patient detail screen. */
export function PatientTable({ patients, locale, emptyMessage }: PatientTableProps) {
  const t = getT(locale);

  if (patients.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface-raised px-4 py-8 text-center text-sm text-muted">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface-raised">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="px-4 py-2 font-medium">{t("patients.name")}</th>
            <th className="px-4 py-2 font-medium">{t("patients.phone")}</th>
            <th className="px-4 py-2 font-medium">{t("patients.nic")}</th>
            <th className="px-4 py-2 font-medium">{t("patients.gender")}</th>
          </tr>
        </thead>
        <tbody>
          {patients.map((p) => (
            <tr key={p.id} className="border-b border-border last:border-0 hover:bg-surface">
              <td className="px-4 py-2">
                <Link href={`/patients/${p.id}`} className="font-medium text-primary-dark hover:underline">
                  {p.fullName}
                </Link>
              </td>
              <td className="px-4 py-2 text-ink">{p.phone}</td>
              <td className="px-4 py-2 text-muted">{p.nic || "—"}</td>
              <td className="px-4 py-2 text-muted">{p.gender ? t(`patients.gender_${p.gender}`) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
