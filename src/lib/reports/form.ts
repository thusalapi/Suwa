import type { Template } from "@/lib/report-engine/template";
import type { ReportData, ResultValue } from "@/lib/report-engine/report-data";

/**
 * Raw, stringy form maps the report entry form reads — the inverse of the service's `buildData`.
 * Pure (no "server-only") so the edit page and unit tests can both use it.
 */
export interface ReportFormInputs {
  /** patient_info field key → value as string. */
  patientInfo: Record<string, string>;
  /** results_table row key → numeric value as string. */
  results: Record<string, string>;
  /** field/textarea key → value as string. */
  values: Record<string, string>;
}

/**
 * Flatten stored `ReportData` back into the raw string maps the `ReportFormRenderer` prefills
 * from, driven by the (snapshot) template so only known keys are surfaced. Mirrors the shape
 * `buildData` (lib/reports) consumes, so an edit round-trips: render → submit → store.
 */
export function reportDataToFormInputs(snapshot: Template, data: ReportData): ReportFormInputs {
  const patientInfo: Record<string, string> = {};
  const results: Record<string, string> = {};
  const values: Record<string, string> = {};

  const storedPi = (data.patient_info ?? {}) as Record<string, string | number>;
  const storedResults = (data.results ?? {}) as Record<string, ResultValue>;

  for (const section of snapshot.sections) {
    switch (section.type) {
      case "patient_info":
        for (const f of section.fields) {
          const v = storedPi[f];
          if (v != null) patientInfo[f] = String(v);
        }
        break;
      case "results_table":
        for (const row of section.rows) {
          const entry = storedResults[row.key];
          if (entry != null) results[row.key] = String(entry.value);
        }
        break;
      case "field":
      case "textarea": {
        const v = data[section.key];
        if (v != null && v !== "") values[section.key] = String(v);
        break;
      }
      default:
        break;
    }
  }

  return { patientInfo, results, values };
}
