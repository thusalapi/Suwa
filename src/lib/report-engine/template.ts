import { z } from "zod";
import { PATIENT_VARS, formulaRefs, parseFormula } from "./formula";

/**
 * Template schema — the heart of the report engine. A template is stored as JSONB on
 * `report_templates.schema` and, when a report is created, the FULL schema is frozen into
 * `reports.template_snapshot` so issued reports re-render identically forever
 * (docs/report-engine.md). One schema drives three outputs: data-entry form, PDF, stored JSON.
 *
 * Types are inferred from these Zod validators so the runtime contract and the TS types can
 * never drift.
 */

/** snake_case identifier used as a data key (form field, textarea, or analyte row). */
const key = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9_]*$/, "key must be snake_case (a-z, 0-9, _)");

/**
 * Optional free-form position for a block, used when the template `layout` is "canvas".
 * x / y / w are PERCENTAGES (0–100) of the page content box (x,w of width; y of height);
 * height flows from content. Absent ⇒ the block is laid out in normal flow order.
 */
const positionSchema = z
  .object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    w: z.number().min(5).max(100),
  })
  .optional();

/**
 * Fields a `patient_info` block can show. `name`/`age`/`gender` are auto-filled from the patient
 * record (read-only on the form); the rest are manual per-report entries (referring/requesting
 * doctor, specimen number, date & time, specimen source). All are stored on the report so the
 * issued document is reproducible.
 */
export const PATIENT_INFO_FIELDS = [
  "name",
  "age",
  "gender",
  "ref_doctor",
  "referred_by",
  "requested_by",
  "specimen_no",
  "datetime",
  "source",
] as const;
export type PatientInfoField = (typeof PATIENT_INFO_FIELDS)[number];

/** Patient-derived fields (prefilled + read-only). Everything else in a block is manual entry. */
export const PATIENT_DERIVED_FIELDS = ["name", "age", "gender"] as const;

/** Manual `patient_info` fields whose input is a datetime rather than free text. */
export const PATIENT_DATETIME_FIELDS = ["datetime"] as const;

export const FIELD_INPUT_TYPES = ["text", "number", "date", "select"] as const;

// --- block types (discriminated on `type`) ---
// NOTE: discriminatedUnion requires plain ZodObjects, so cross-field rules (select needs
// options, ref_low <= ref_high, unique keys) live in templateSchema.superRefine below.

const patientInfoSection = z.object({
  type: z.literal("patient_info"),
  fields: z.array(z.enum(PATIENT_INFO_FIELDS)).min(1),
  /** Prefill for "Source of Specimen" on a new report (e.g. "Urine"). Default "Blood". */
  defaultSource: z.string().trim().min(1).optional(),
  pos: positionSchema,
});

const staticSection = z.object({
  type: z.literal("static"),
  text: z.string().min(1),
  heading: z.boolean().optional(),
  /** A small bold line (e.g. "Elevated in:") — between a heading and body text. */
  subheading: z.boolean().optional(),
  pos: positionSchema,
});

const fieldSection = z.object({
  type: z.literal("field"),
  key,
  label: z.string().min(1),
  inputType: z.enum(FIELD_INPUT_TYPES),
  options: z.array(z.string().min(1)).min(1).optional(),
  required: z.boolean().optional(),
  pos: positionSchema,
});

const resultRow = z.object({
  key,
  test: z.string().min(1),
  unit: z.string().optional(),
  /** Optional second unit shown alongside the first, derived from `factor2` (e.g. mg/dl→mmol/l). */
  unit2: z.string().optional(),
  /** value2 = value × factor2 (computed + stored on entry). Requires `unit2`. */
  factor2: z.number().optional(),
  /** Second value from arithmetic over other rows (e.g. `wbc * neut / 100` for an absolute count).
   *  Requires `unit2`; an alternative to `factor2`. */
  formula2: z.string().trim().min(1).optional(),
  /** "number" (default) flags against the range; "text" stores a qualitative value (e.g. "B Positive"). */
  value_type: z.enum(["number", "text"]).optional(),
  /** Calculated row: the value is arithmetic over other rows' keys (e.g. `hb * 100 / pcv`), not
   *  entered by hand. See formula.ts for the grammar. */
  formula: z.string().trim().min(1).optional(),
  /** Decimal places a calculated value (`formula`) is rounded to before it is stored (default 1);
   *  when set, the value is also always shown with that many places (e.g. 57.50). */
  decimals: z.number().int().min(0).max(6).optional(),
  /** Decimal places for `formula2`. Default 0. */
  decimals2: z.number().int().min(0).max(6).optional(),
  ref_low: z.number().optional(),
  ref_high: z.number().optional(),
  critical_low: z.number().optional(),
  critical_high: z.number().optional(),
  /** Printed reference range, verbatim (e.g. "120-200 mg/dl", "(3.0-5.0)"). Display only — flags
   *  still come from the numeric bounds above. */
  ref_text: z.string().trim().min(1).optional(),
});

const resultsTableSection = z.object({
  type: z.literal("results_table"),
  title: z.string().optional(),
  /** "table" (default): the 5-column Test/Result/Unit/Range/Flag grid. "list": a compact
   *  Test — Result two-column list (the lab house style); ranges live in a separate static block.
   *  "dual": Test | value unit | value2 unit2 (e.g. a differential count beside its absolute count).
   *  "ranged": Test | value | unit | reference range, with no flag column (the printed FBC style). */
  style: z.enum(["table", "list", "dual", "ranged"]).optional(),
  /** Column labels for the "list"/"dual"/"ranged" header (e.g. CHEMISTRY / RESULT). Omit to hide it. */
  listHeader: z.object({ left: z.string().min(1), right: z.string().min(1) }).optional(),
  /** Heading over the reference-range column in the "ranged" style (e.g. "REF. VALUE"). */
  rangeHeader: z.string().min(1).optional(),
  rows: z.array(resultRow).min(1),
  pos: positionSchema,
});

const textareaSection = z.object({
  type: z.literal("textarea"),
  key,
  label: z.string().min(1),
  pos: positionSchema,
});

/**
 * A fixed table of text (e.g. a lipid risk chart): column headers + rows of cells. Nothing is
 * entered or calculated. A cell may contain "
" for a second line.
 */
const tableSection = z.object({
  type: z.literal("table"),
  title: z.string().optional(),
  columns: z.array(z.string()).min(1),
  /** Relative column widths (any positive numbers; normalised to 100%). Default: equal. */
  widths: z.array(z.number().positive()).optional(),
  rows: z.array(z.array(z.string())).min(1),
  pos: positionSchema,
});

const signatureSection = z.object({
  type: z.literal("signature"),
  label: z.string().min(1),
  /** Optional line under the verifier's name, e.g. "Medical Laboratory Technologist · SLMC Reg.". */
  subtitle: z.string().optional(),
  pos: positionSchema,
});

export const sectionSchema = z.discriminatedUnion("type", [
  patientInfoSection,
  staticSection,
  fieldSection,
  resultsTableSection,
  textareaSection,
  tableSection,
  signatureSection,
]);

/** Data namespaces the engine owns; a field/textarea key may not collide with these. */
const RESERVED_KEYS = ["patient_info", "results"];

export const templateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    version: z.number().int().positive(),
    /** Absent/"flow": blocks stack top-to-bottom. "canvas": blocks are placed by their `pos`. */
    layout: z.enum(["flow", "canvas"]).optional(),
    /** System-managed template (layout + formulas are fixed): the editor refuses to change it.
     *  Only set by seed scripts — the UI strips it from anything it saves. */
    locked: z.boolean().optional(),
    sections: z.array(sectionSchema).min(1),
  })
  .superRefine((tpl, ctx) => {
    const topKeys = new Set<string>();
    const rowKeys = new Set<string>();

    tpl.sections.forEach((s, i) => {
      if (s.type === "field") {
        if (s.inputType === "select" && !s.options?.length) {
          ctx.addIssue({ code: "custom", message: "select fields need options", path: ["sections", i, "options"] });
        }
        if (RESERVED_KEYS.includes(s.key) || topKeys.has(s.key)) {
          ctx.addIssue({
            code: "custom",
            message: `duplicate or reserved key "${s.key}"`,
            path: ["sections", i, "key"],
          });
        }
        topKeys.add(s.key);
      } else if (s.type === "textarea") {
        if (RESERVED_KEYS.includes(s.key) || topKeys.has(s.key)) {
          ctx.addIssue({
            code: "custom",
            message: `duplicate or reserved key "${s.key}"`,
            path: ["sections", i, "key"],
          });
        }
        topKeys.add(s.key);
      } else if (s.type === "table") {
        const n = s.columns.length;
        if (s.widths && s.widths.length !== n) {
          ctx.addIssue({ code: "custom", message: "widths must match columns", path: ["sections", i, "widths"] });
        }
        s.rows.forEach((row, j) => {
          if (row.length !== n) {
            ctx.addIssue({
              code: "custom",
              message: `row has ${row.length} cells, expected ${n}`,
              path: ["sections", i, "rows", j],
            });
          }
        });
      } else if (s.type === "results_table") {
        s.rows.forEach((r, j) => {
          if (r.ref_low != null && r.ref_high != null && r.ref_low > r.ref_high) {
            ctx.addIssue({
              code: "custom",
              message: "ref_low must be <= ref_high",
              path: ["sections", i, "rows", j, "ref_low"],
            });
          }
          if (r.factor2 != null && !r.unit2) {
            ctx.addIssue({
              code: "custom",
              message: "factor2 requires unit2",
              path: ["sections", i, "rows", j, "factor2"],
            });
          }
          if (r.formula2 != null && (!r.unit2 || r.factor2 != null)) {
            ctx.addIssue({
              code: "custom",
              message: "formula2 requires unit2 and can't be combined with factor2",
              path: ["sections", i, "rows", j, "formula2"],
            });
          }
          if (r.formula != null && r.value_type === "text") {
            ctx.addIssue({
              code: "custom",
              message: "a calculated row must be numeric",
              path: ["sections", i, "rows", j, "formula"],
            });
          }
          if (rowKeys.has(r.key)) {
            ctx.addIssue({
              code: "custom",
              message: `duplicate result key "${r.key}"`,
              path: ["sections", i, "rows", j, "key"],
            });
          }
          rowKeys.add(r.key);
        });
      }
    });

    // Formulas: must parse, may only read numeric rows, and calculated rows can't form a cycle.
    const rows = resultRows(tpl);
    const numericKeys = new Set(rows.filter((r) => r.value_type !== "text").map((r) => r.key));
    const deps = new Map<string, string[]>();
    for (const r of rows) {
      for (const field of ["formula", "formula2"] as const) {
        const src = r[field];
        if (src == null) continue;
        let refs: string[];
        try {
          refs = formulaRefs(parseFormula(src));
        } catch (e) {
          ctx.addIssue({ code: "custom", message: `${r.key}.${field}: ${(e as Error).message}`, path: ["sections"] });
          continue;
        }
        const unknown = refs.filter((k) => !numericKeys.has(k) && !(PATIENT_VARS as readonly string[]).includes(k));
        if (unknown.length) {
          ctx.addIssue({
            code: "custom",
            message: `${r.key}.${field} refers to unknown or non-numeric rows: ${unknown.join(", ")}`,
            path: ["sections"],
          });
        }
        if (field === "formula")
          deps.set(
            r.key,
            refs.filter((k) => numericKeys.has(k)),
          );
      }
    }
    if (formulaOrder(deps) == null) {
      ctx.addIssue({ code: "custom", message: "calculated rows refer to each other in a cycle", path: ["sections"] });
    }
  });

/**
 * Evaluation order for calculated rows (each after the rows it reads), or null on a cycle.
 * `deps` maps a calculated row's key to the keys its formula reads.
 */
export function formulaOrder(deps: Map<string, string[]>): string[] | null {
  const order: string[] = [];
  const state = new Map<string, "visiting" | "done">();
  const visit = (key: string): boolean => {
    const s = state.get(key);
    if (s === "done") return true;
    if (s === "visiting") return false;
    state.set(key, "visiting");
    for (const d of deps.get(key) ?? []) if (deps.has(d) && !visit(d)) return false;
    state.set(key, "done");
    order.push(key);
    return true;
  };
  for (const key of deps.keys()) if (!visit(key)) return null;
  return order;
}

export type Template = z.infer<typeof templateSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type Position = NonNullable<z.infer<typeof positionSchema>>;

/**
 * A4 content box (page size minus the PDF margins) in points — the coordinate space `pos`
 * percentages resolve against. The builder canvas uses this aspect ratio; the PDF converts
 * each block's percentages to points with these dimensions so editor and print match.
 */
export const PAGE_CONTENT = { width: 515.28, height: 757.89 } as const;
export type ResultRow = z.infer<typeof resultRow>;
export type FieldSection = Extract<Section, { type: "field" }>;
export type ResultsTableSection = Extract<Section, { type: "results_table" }>;
export type PatientInfoSection = Extract<Section, { type: "patient_info" }>;
export type TableSection = Extract<Section, { type: "table" }>;

/** Column widths of a table block as percentages summing to 100. */
export function tableWidths(s: TableSection): number[] {
  const w = s.widths ?? s.columns.map(() => 1);
  const total = w.reduce((a, b) => a + b, 0);
  return w.map((x) => (x / total) * 100);
}

/** Parse + validate unknown JSON (e.g. a stored snapshot) into a Template. Throws on invalid. */
export function parseTemplate(input: unknown): Template {
  return templateSchema.parse(input);
}

/** All analyte rows across every results_table in a template (rows share the `results` map). */
export function resultRows(template: Template): ResultRow[] {
  return template.sections.flatMap((s) => (s.type === "results_table" ? s.rows : []));
}
