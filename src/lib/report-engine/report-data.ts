import { z } from "zod";
import { FLAGS, computeFlag, type Flag } from "./flag";
import { formulaOrder, resultRows, type Template } from "./template";
import { evaluateFormula, formulaRefs, parseFormula, patientVars, roundTo } from "./formula";

/**
 * Filled report data: the values entered against a template, stored as JSONB on `reports.data`.
 * The shape is derived from the (snapshotted) template, so the same schema validates entry and
 * re-render. See docs/report-engine.md "Filled report data".
 */
export interface ResultValue {
  /** Numeric for flagged analytes; string for qualitative rows (`value_type: "text"`). */
  value: number | string;
  /** Present only for numeric rows (computed against the reference range). */
  flag?: Flag;
  /** Optional second-unit value (value × `factor2`), e.g. mmol/l beside mg/dl. */
  value2?: number;
}

export interface ReportData {
  patient_info?: Record<string, string | number>;
  results?: Record<string, ResultValue>;
  /** field/textarea values, keyed by their template key. */
  [key: string]: unknown;
}

const flagSchema = z.enum(FLAGS);
const numericResultSchema = z.object({ value: z.number(), flag: flagSchema, value2: z.number().optional() });
const textResultSchema = z.object({ value: z.string() });

/** The Zod schema for a single field block's value, by input type. */
function fieldValueSchema(field: Extract<Template["sections"][number], { type: "field" }>): z.ZodTypeAny {
  switch (field.inputType) {
    case "number":
      return z.number();
    case "date":
      return z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
    case "select":
      // options is guaranteed non-empty for select by templateSchema validation.
      return z.enum((field.options ?? [""]) as [string, ...string[]]);
    case "text":
    default:
      return z.string();
  }
}

/**
 * Build a Zod schema that validates filled data against a given template. Entries are optional
 * (drafts can be partial); required `field`s are enforced. `.strict()` rejects unknown keys so
 * data can't drift from the template.
 */
export function buildReportDataSchema(template: Template): z.ZodTypeAny {
  const shape: Record<string, z.ZodTypeAny> = {};

  const patientInfo = template.sections.find((s) => s.type === "patient_info");
  if (patientInfo) {
    const piShape: Record<string, z.ZodTypeAny> = {};
    for (const f of patientInfo.fields) {
      piShape[f] = (f === "age" ? z.number().int().nonnegative() : z.string()).optional();
    }
    shape.patient_info = z.object(piShape).partial().optional();
  }

  const rows = resultRows(template);
  if (rows.length > 0) {
    const resultsShape: Record<string, z.ZodTypeAny> = {};
    for (const r of rows) {
      resultsShape[r.key] = (r.value_type === "text" ? textResultSchema : numericResultSchema).optional();
    }
    shape.results = z.object(resultsShape).partial().optional();
  }

  for (const s of template.sections) {
    if (s.type === "field") {
      const value = fieldValueSchema(s);
      shape[s.key] = s.required ? value : value.optional();
    } else if (s.type === "textarea") {
      shape[s.key] = z.string().optional();
    }
  }

  return z.object(shape).strict();
}

/**
 * Display text for a stored value: numbers use the row's fixed `decimals` when set (57.5 → "57.50"),
 * anything else prints as stored.
 */
export function formatResult(value: number | string, row: { decimals?: number }): string {
  return typeof value === "number" && row.decimals != null ? value.toFixed(row.decimals) : String(value);
}

/** Validate filled data against its template. Returns the parsed data or a flattened error. */
export function validateReportData(template: Template, data: unknown) {
  return buildReportDataSchema(template).safeParse(data);
}

/**
 * Compute the stored results map from raw entered values. Numeric rows are classified against
 * their reference range (and given a second-unit `value2` when the row defines `factor2`); text
 * rows (`value_type: "text"`) store the trimmed string verbatim with no flag. Blank entries — and
 * non-numeric entries in numeric rows — are skipped (not yet filled).
 */
export function computeResults(
  template: Template,
  values: Record<string, number | string | null | undefined>,
  /** The report's patient_info — supplies `age` / `male` / `female` to formulas. */
  patientInfo?: Record<string, unknown>,
): Record<string, ResultValue> {
  const out: Record<string, ResultValue> = {};
  const rows = resultRows(template);
  for (const row of rows) {
    if (row.formula != null) continue; // calculated below, never taken from input
    const v = values[row.key];
    if (v == null || v === "") continue;

    if (row.value_type === "text") {
      out[row.key] = { value: String(v).trim() };
      continue;
    }

    const n = typeof v === "number" ? v : Number(v);
    if (Number.isNaN(n)) continue;
    const entry: ResultValue = { value: n, flag: computeFlag(n, row) };
    // Truncated (not rounded) to 1 dp, as the lab prints it: 111 mg/dl → 6.1605 → 6.1 mmol/l.
    // The epsilon keeps float noise (e.g. 5.6 * 10 = 55.99999…) from dropping a digit.
    if (row.factor2 != null && row.unit2) entry.value2 = Math.trunc(n * row.factor2 * 10 + 1e-9) / 10;
    out[row.key] = entry;
  }

  // Calculated rows, each after the rows it reads. A formula sees the ROUNDED stored values, so
  // the printed numbers are consistent with each other (e.g. MCV derived from the printed RBC).
  const pv = patientVars(patientInfo);
  const numeric = (): Record<string, number> => ({
    ...pv,
    ...Object.fromEntries(Object.entries(out).flatMap(([k, e]) => (typeof e.value === "number" ? [[k, e.value]] : []))),
  });
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const deps = new Map(
    rows.flatMap((r) => (r.formula != null ? [[r.key, formulaRefs(parseFormula(r.formula))] as const] : [])),
  );
  for (const key of formulaOrder(deps) ?? []) {
    const row = byKey.get(key)!;
    const n = evaluateFormula(parseFormula(row.formula!), numeric());
    if (n == null) continue;
    const value = roundTo(n, row.decimals ?? 1);
    out[key] = { value, flag: computeFlag(value, row) };
  }

  const known = numeric();
  for (const row of rows) {
    const entry = out[row.key];
    if (row.formula2 == null || !row.unit2 || entry == null) continue;
    const n = evaluateFormula(parseFormula(row.formula2), known);
    if (n != null) entry.value2 = roundTo(n, row.decimals2 ?? 0);
  }
  return out;
}
