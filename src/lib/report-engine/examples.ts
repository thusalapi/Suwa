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
