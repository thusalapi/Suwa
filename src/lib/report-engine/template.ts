import { z } from "zod";

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
  pos: positionSchema,
});

const staticSection = z.object({
  type: z.literal("static"),
  text: z.string().min(1),
  heading: z.boolean().optional(),
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
  /** "number" (default) flags against the range; "text" stores a qualitative value (e.g. "B Positive"). */
  value_type: z.enum(["number", "text"]).optional(),
  ref_low: z.number().optional(),
  ref_high: z.number().optional(),
  critical_low: z.number().optional(),
  critical_high: z.number().optional(),
});

const resultsTableSection = z.object({
  type: z.literal("results_table"),
  title: z.string().optional(),
  /** "table" (default): the 5-column Test/Result/Unit/Range/Flag grid. "list": a compact
   *  Test — Result two-column list (the lab house style); ranges live in a separate static block. */
  style: z.enum(["table", "list"]).optional(),
  /** Column labels for the "list" style header (e.g. CHEMISTRY / RESULT). Omit to hide the header. */
  listHeader: z.object({ left: z.string().min(1), right: z.string().min(1) }).optional(),
  rows: z.array(resultRow).min(1),
  pos: positionSchema,
});

const textareaSection = z.object({
  type: z.literal("textarea"),
  key,
  label: z.string().min(1),
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
  });

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

/** Parse + validate unknown JSON (e.g. a stored snapshot) into a Template. Throws on invalid. */
export function parseTemplate(input: unknown): Template {
  return templateSchema.parse(input);
}

/** All analyte rows across every results_table in a template (rows share the `results` map). */
export function resultRows(template: Template): ResultRow[] {
  return template.sections.flatMap((s) => (s.type === "results_table" ? s.rows : []));
}
