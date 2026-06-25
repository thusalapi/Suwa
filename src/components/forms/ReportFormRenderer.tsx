"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Field } from "@/components/atoms/Field";
import { Input } from "@/components/atoms/Input";
import { Label } from "@/components/atoms/Label";
import { Button } from "@/components/atoms/Button";
import { Badge } from "@/components/atoms/Badge";
import { Spinner } from "@/components/atoms/Spinner";
import { cn } from "@/lib/utils/cn";
import { getT } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/types";
import type { Template, ResultRow } from "@/lib/report-engine/template";
import { computeFlag, isAbnormal, isCritical, type Flag } from "@/lib/report-engine/flag";

/** Minimal state the report form reports back via `useActionState`. */
export interface ReportFormState {
  error?: string;
  detail?: string;
}

export interface ReportFormRendererProps {
  locale: Locale;
  /** The (snapshot) template that drives the form. */
  snapshot: Template;
  patientId: string;
  templateId: string;
  /** Prefill for patient_info (name/age/gender derived from the patient record). */
  patientInfo: Record<string, string>;
  action: (prev: ReportFormState, formData: FormData) => Promise<ReportFormState>;
  submitLabel: string;
}

const selectClass = cn(
  "h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-ink",
  "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary",
);

function rangeLabel(row: ResultRow): string {
  if (row.ref_low != null && row.ref_high != null) return `${row.ref_low}–${row.ref_high}`;
  if (row.ref_low != null) return `≥ ${row.ref_low}`;
  if (row.ref_high != null) return `≤ ${row.ref_high}`;
  return "—";
}

function FlagBadge({ flag, label }: { flag: Flag; label: string }) {
  if (!isAbnormal(flag)) return <span className="text-xs text-muted">{label}</span>;
  return (
    <Badge tone="danger" className={isCritical(flag) ? "font-bold" : undefined}>
      {label}
    </Badge>
  );
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Spinner label={pendingLabel} /> : null}
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function ReportFormRenderer({
  locale,
  snapshot,
  patientId,
  templateId,
  patientInfo,
  action,
  submitLabel,
}: ReportFormRendererProps) {
  const t = getT(locale);
  const [state, formAction] = useActionState<ReportFormState, FormData>(action, {});
  // Live result values keyed by row key, so flags update as staff type.
  const [resultValues, setResultValues] = useState<Record<string, string>>({});

  const flagFor = (row: ResultRow): Flag | null => {
    const raw = resultValues[row.key]?.trim();
    if (!raw) return null;
    const n = Number(raw);
    return Number.isNaN(n) ? null : computeFlag(n, row);
  };

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="templateId" value={templateId} />

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
              <section key={i} className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {section.fields.map((f) => {
                  const editable = f === "ref_doctor";
                  return (
                    <Field key={f} label={t(`reports.pi_${f}`)} htmlFor={`pi_${f}`}>
                      <Input
                        id={`pi_${f}`}
                        name={`pi.${f}`}
                        defaultValue={patientInfo[f] ?? ""}
                        readOnly={!editable}
                        className={editable ? undefined : "bg-surface text-muted"}
                      />
                    </Field>
                  );
                })}
              </section>
            );

          case "results_table":
            return (
              <section key={i} className="space-y-2">
                {section.title ? (
                  <h3 className="text-sm font-semibold text-ink">{section.title}</h3>
                ) : null}
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
                        const flag = flagFor(row);
                        return (
                          <tr key={row.key} className="border-b border-border last:border-0">
                            <td className="px-3 py-2 text-ink">{row.test}</td>
                            <td className="px-3 py-2">
                              <Input
                                name={`res.${row.key}`}
                                type="number"
                                step="any"
                                inputMode="decimal"
                                aria-label={`${row.test} ${t("reports.result")}`}
                                value={resultValues[row.key] ?? ""}
                                onChange={(e) =>
                                  setResultValues((prev) => ({ ...prev, [row.key]: e.target.value }))
                                }
                                className="h-9 max-w-[8rem]"
                              />
                            </td>
                            <td className="px-3 py-2 text-muted">{row.unit || "—"}</td>
                            <td className="px-3 py-2 text-muted">{rangeLabel(row)}</td>
                            <td className="px-3 py-2">
                              {flag ? <FlagBadge flag={flag} label={t(`reports.flag_${flag}`)} /> : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );

          case "field":
            return (
              <Field key={i} label={section.label} htmlFor={`fld_${section.key}`}>
                {section.inputType === "select" ? (
                  <select id={`fld_${section.key}`} name={`fld.${section.key}`} className={selectClass} defaultValue="">
                    <option value="">—</option>
                    {(section.options ?? []).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id={`fld_${section.key}`}
                    name={`fld.${section.key}`}
                    type={section.inputType === "number" ? "number" : section.inputType === "date" ? "date" : "text"}
                    step={section.inputType === "number" ? "any" : undefined}
                    required={section.required}
                  />
                )}
              </Field>
            );

          case "textarea":
            return (
              <div key={i} className="space-y-1.5">
                <Label htmlFor={`txt_${section.key}`}>{section.label}</Label>
                <textarea
                  id={`txt_${section.key}`}
                  name={`txt.${section.key}`}
                  rows={3}
                  className={cn(
                    "w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-ink",
                    "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary",
                  )}
                />
              </div>
            );

          case "signature":
            return (
              <p key={i} className="text-sm text-muted">
                {section.label}: {t("reports.pendingVerification")}
              </p>
            );

          default:
            return null;
        }
      })}

      {state.error ? (
        <div role="alert" className="space-y-1 rounded-md border border-danger/30 bg-danger/10 p-3">
          <p className="text-sm font-medium text-danger">{t(state.error)}</p>
          {state.detail ? <p className="font-mono text-xs text-danger">{state.detail}</p> : null}
        </div>
      ) : null}

      <SubmitButton label={submitLabel} pendingLabel={t("common.saving")} />
    </form>
  );
}
