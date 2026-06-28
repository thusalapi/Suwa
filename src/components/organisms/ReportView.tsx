import { Badge } from "@/components/atoms/Badge";
import { getT } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/types";
import type { Template, ResultRow } from "@/lib/report-engine/template";
import { isAbnormal, isCritical, type Flag } from "@/lib/report-engine/flag";
import type { ReportData, ResultValue } from "@/lib/report-engine/report-data";

export interface ReportViewProps {
  locale: Locale;
  snapshot: Template;
  data: ReportData;
}

function rangeLabel(row: ResultRow): string {
  if (row.ref_low != null && row.ref_high != null) return `${row.ref_low}–${row.ref_high}`;
  if (row.ref_low != null) return `≥ ${row.ref_low}`;
  if (row.ref_high != null) return `≤ ${row.ref_high}`;
  return "—";
}

/**
 * Read-only render of a report from its frozen snapshot + stored data. Mirrors what the PDF
 * renderer will emit. Flags are read from stored data, never recomputed (reproducibility).
 */
export function ReportView({ locale, snapshot, data }: ReportViewProps) {
  const t = getT(locale);
  const results = (data.results ?? {}) as Record<string, ResultValue>;
  const patientInfo = (data.patient_info ?? {}) as Record<string, string | number>;

  return (
    <div className="space-y-6">
      {snapshot.sections.map((section, i) => {
        switch (section.type) {
          case "static":
            return section.heading ? (
              <h2 key={i} className="text-lg font-semibold text-ink">
                {section.text}
              </h2>
            ) : (
              <p key={i} className="text-sm text-muted">
                {section.text}
              </p>
            );

          case "patient_info":
            return (
              <dl key={i} className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {section.fields.map((f) => (
                  <div key={f} className="space-y-0.5">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted">{t(`reports.pi_${f}`)}</dt>
                    <dd className="text-sm text-ink">{patientInfo[f] != null ? String(patientInfo[f]) : "—"}</dd>
                  </div>
                ))}
              </dl>
            );

          case "results_table":
            if (section.style === "list") {
              return (
                <section key={i} className="space-y-2">
                  {section.title ? <h3 className="text-sm font-semibold text-primary-dark">{section.title}</h3> : null}
                  <div className="overflow-hidden rounded-lg border border-border bg-surface-raised">
                    {section.listHeader ? (
                      <div className="flex border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
                        <span className="flex-1">{section.listHeader.left}</span>
                        <span className="w-1/2">{section.listHeader.right}</span>
                      </div>
                    ) : null}
                    {section.rows.map((row) => {
                      const entry = results[row.key];
                      return (
                        <div
                          key={row.key}
                          className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-0"
                        >
                          <span className="flex-1 text-ink">{row.test}</span>
                          <span className="w-1/2 text-ink">
                            {entry != null ? (
                              <>
                                {entry.value}
                                {row.unit ? ` ${row.unit}` : ""}
                                {entry.value2 != null && row.unit2 ? `   ${entry.value2} ${row.unit2}` : ""}
                              </>
                            ) : (
                              "—"
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            }
            return (
              <section key={i} className="space-y-2">
                {section.title ? <h3 className="text-sm font-semibold text-ink">{section.title}</h3> : null}
                <div className="overflow-hidden rounded-lg border border-border bg-surface-raised">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-muted">
                        <th className="px-3 py-2 font-medium">{t("reports.test")}</th>
                        <th className="px-3 py-2 font-medium">{t("reports.result")}</th>
                        <th className="px-3 py-2 font-medium">{t("reports.unit")}</th>
                        <th className="px-3 py-2 font-medium">{t("reports.refRange")}</th>
                        <th className="px-3 py-2 font-medium">{t("reports.flag")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.rows.map((row) => {
                        const entry = results[row.key];
                        const flag = entry?.flag as Flag | undefined;
                        return (
                          <tr key={row.key} className="border-b border-border last:border-0">
                            <td className="px-3 py-2 text-ink">{row.test}</td>
                            <td
                              className={
                                flag && isAbnormal(flag)
                                  ? `px-3 py-2 font-semibold text-ink ${isCritical(flag) ? "bg-danger/10" : ""}`
                                  : "px-3 py-2 text-ink"
                              }
                            >
                              {entry ? entry.value : "—"}
                            </td>
                            <td className="px-3 py-2 text-muted">{row.unit || "—"}</td>
                            <td className="px-3 py-2 text-muted">{rangeLabel(row)}</td>
                            <td className="px-3 py-2">
                              {flag && isAbnormal(flag) ? (
                                <Badge tone="danger" className={isCritical(flag) ? "font-bold" : undefined}>
                                  {t(`reports.flag_${flag}`)}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted">{flag ? t(`reports.flag_${flag}`) : "—"}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );

          case "field": {
            const value = data[section.key];
            return (
              <div key={i} className="space-y-0.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">{section.label}</p>
                <p className="text-sm text-ink">{value != null && value !== "" ? String(value) : "—"}</p>
              </div>
            );
          }

          case "textarea": {
            const value = data[section.key];
            return (
              <div key={i} className="space-y-0.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">{section.label}</p>
                <p className="whitespace-pre-wrap text-sm text-ink">
                  {value != null && value !== "" ? String(value) : "—"}
                </p>
              </div>
            );
          }

          case "signature":
            return null; // verifier shown in the page header

          default:
            return null;
        }
      })}
    </div>
  );
}
