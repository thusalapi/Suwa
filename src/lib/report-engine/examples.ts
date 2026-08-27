import type { Template } from "./template";

/**
 * Example template (the Full Blood Count from docs/report-engine.md). Typed with `satisfies`
 * so it's compile-time-checked against the schema and stays valid as the engine evolves. Used
 * as a fixture while building the form/PDF renderers and as a model for hand-built templates.
 */
export const fbcTemplate = {
  name: "Full Blood Count",
  version: 1,
  sections: [
    { type: "patient_info", fields: ["name", "age", "gender", "ref_doctor"] },
    {
      type: "results_table",
      title: "Full Blood Count (FBC)",
      rows: [
        { key: "hb", test: "Hemoglobin", unit: "g/dL", ref_low: 13.0, ref_high: 17.0 },
        { key: "wbc", test: "WBC", unit: "x10^3/uL", ref_low: 4.0, ref_high: 11.0 },
        { key: "plt", test: "Platelets", unit: "x10^3/uL", ref_low: 150, ref_high: 410 },
      ],
    },
    { type: "textarea", key: "comments", label: "Comments" },
    { type: "signature", label: "Verified by" },
  ],
} satisfies Template;

/**
 * Fasting Blood Sugar — modelled on Unawatuna Medical Centre's house format: a two-column
 * patient/specimen block, a compact "list" result with dual units (mg/dl + auto-derived mmol/l),
 * an Expected-values block + lab notes as static text, and a technologist signature line.
 */
export const fastingBloodSugarTemplate = {
  name: "Fasting Blood Sugar",
  version: 1,
  sections: [
    { type: "patient_info", fields: ["name", "age", "gender", "referred_by", "specimen_no", "datetime", "source"] },
    {
      type: "results_table",
      style: "list",
      title: "Fasting Blood Sugar",
      listHeader: { left: "Chemistry", right: "Result" },
      rows: [{ key: "fbs", test: "Fasting Blood Sugar", unit: "mg/dl", unit2: "mmol/l", factor2: 0.0555 }],
    },
    { type: "static", heading: true, text: "EXPECTED VALUES" },
    { type: "static", text: "70 - 100 mg/dl  :  Normal" },
    { type: "static", text: "101 - 125 mg/dl  :  Impaired" },
    { type: "static", text: ">= 126 mg/dl  :  High" },
    {
      type: "static",
      text:
        "Note:  1. The values will vary from one laboratory to another.\n" +
        "          2. Laboratory values depend on the age, sex and time of collecting the samples, and may vary accordingly.\n" +
        "          3. Laboratory reports should not be interpreted in isolation. They should always be correlated with clinical findings and other medical reports.",
    },
    { type: "signature", label: "Verified by", subtitle: "Medical Laboratory Technologist · SLMC Reg." },
  ],
} satisfies Template;

/**
 * Blood Grouping & Rh — a qualitative report: a single "list" result whose value is text
 * (e.g. "B Positive"), no reference range or flag.
 */
export const bloodGroupingTemplate = {
  name: "Blood Grouping & Rh",
  version: 1,
  sections: [
    { type: "patient_info", fields: ["name", "age", "gender", "requested_by", "datetime"] },
    { type: "static", heading: true, text: "Blood" },
    {
      type: "results_table",
      style: "list",
      rows: [{ key: "blood_group", test: "Blood Grouping & Rh", value_type: "text" }],
    },
    { type: "signature", label: "Verified by", subtitle: "Medical Laboratory Technologist · SLMC Reg." },
  ],
} satisfies Template;
