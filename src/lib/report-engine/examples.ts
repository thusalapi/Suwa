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
  locked: true,
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
 * Full Blood Count — Unawatuna Medical Centre's printed FBC. Staff enter only WBC, the five
 * differential percentages, Hb, PCV and the platelet count; everything else is calculated:
 *   absolute count = WBC × % / 100
 *   RBC  = PCV / 9            (the manual-lab estimate; rounded to 1 dp before the indices use it)
 *   MCHC = Hb × 100 / PCV     MCH = Hb × 10 / RBC     MCV = PCV × 10 / RBC
 */
export const fullBloodCountTemplate = {
  name: "Full Blood Count",
  version: 1,
  locked: true,
  sections: [
    { type: "patient_info", fields: ["name", "age", "gender", "referred_by", "specimen_no", "datetime", "source"] },
    { type: "static", heading: true, text: "Full Blood Count" },
    { type: "results_table", style: "list", rows: [{ key: "wbc", test: "WBC", unit: "/Cu mm" }] },
    {
      type: "results_table",
      style: "dual",
      listHeader: { left: "DIFFERENTIAL COUNT", right: "ABSOLUTE COUNT" },
      rows: [
        { key: "neut", test: "Neutrophils", unit: "%", unit2: "/Cu mm", formula2: "wbc * neut / 100" },
        { key: "lymph", test: "Lymphocytes", unit: "%", unit2: "/Cu mm", formula2: "wbc * lymph / 100" },
        { key: "eos", test: "Eosinophils", unit: "%", unit2: "/Cu mm", formula2: "wbc * eos / 100" },
        { key: "mono", test: "Monocytes", unit: "%", unit2: "/Cu mm", formula2: "wbc * mono / 100" },
        { key: "baso", test: "Basophils", unit: "%", unit2: "/Cu mm", formula2: "wbc * baso / 100" },
      ],
    },
    {
      type: "results_table",
      style: "ranged",
      rangeHeader: "REF. VALUE",
      rows: [
        { key: "hb", test: "Haemoglobin", unit: "g/dl", ref_low: 11.8, ref_high: 16.5 },
        { key: "pcv", test: "P.C.V.", unit: "%", ref_low: 36, ref_high: 47 },
        { key: "mchc", test: "M.C.H.C.", unit: "%", ref_low: 32, ref_high: 36, formula: "hb * 100 / pcv" },
        { key: "rbc", test: "R.B.C.", unit: "M/Cu mm", ref_low: 3.9, ref_high: 5.6, formula: "pcv / 9" },
        { key: "mch", test: "M.C.H.", unit: "Pg", ref_low: 27, ref_high: 33, formula: "hb * 10 / rbc" },
        { key: "mcv", test: "M.C.V.", unit: "fl", ref_low: 76, ref_high: 96, formula: "pcv * 10 / rbc" },
      ],
    },
    {
      type: "results_table",
      style: "ranged",
      rows: [{ key: "plt", test: "Platelet Count", unit: "/Cu mm", ref_low: 150000, ref_high: 450000 }],
    },
    { type: "signature", label: "Verified by", subtitle: "Medical Laboratory Technologist · SLMC Reg." },
  ],
} satisfies Template;

/**
 * Serum Creatinine + eGFR — Unawatuna Medical Centre's printed report. Only creatinine is entered;
 * eGFR uses the CKD-EPI 2021 (race-free) equation with the patient's age and sex from their record:
 *   eGFR = 142 × min(Scr/κ, 1)^α × max(Scr/κ, 1)^-1.200 × 0.9938^age × 1.012 [if female]
 *   κ = 0.7 (female) / 0.9 (male)      α = -0.241 (female) / -0.302 (male)      [ml/min/1.73 m²]
 * Written with `female` (1/0): κ = 0.9 - 0.2·female, α = -0.302 + 0.061·female.
 */
export const serumCreatinineTemplate = {
  name: "Serum Creatinine",
  version: 1,
  locked: true,
  sections: [
    { type: "patient_info", fields: ["name", "age", "gender", "referred_by", "specimen_no", "datetime", "source"] },
    { type: "static", heading: true, text: "Creatinine e GFR" },
    {
      type: "results_table",
      style: "ranged",
      listHeader: { left: "CHEMISTRY", right: "RESULT" },
      rangeHeader: "REF.RANGE",
      rows: [
        { key: "scr", test: "Serum Creatinine", unit: "mg/dl", ref_low: 0.5, ref_high: 1.3 },
        {
          key: "egfr",
          test: "Estimated GFR",
          unit: "ml/min/1.73 m2",
          ref_low: 60,
          ref_high: 120,
          formula:
            "142 * min(scr / (0.9 - 0.2 * female), 1) ^ (-0.302 + 0.061 * female)" +
            " * max(scr / (0.9 - 0.2 * female), 1) ^ -1.2 * 0.9938 ^ age * (1 + 0.012 * female)",
          decimals: 2,
        },
      ],
    },
    { type: "static", heading: true, text: "SERUM CREATININE" },
    { type: "static", subheading: true, text: "Elevated in:" },
    {
      type: "static",
      text:
        "Renal insufficiency (acute and chronic), decreased renal perfusion (hypotension, dehydration, " +
        "congestive heart failure), urinary tract infection, rhabdomyolysis, ketonemia.",
    },
    {
      type: "static",
      text: "Drugs (antibiotics [aminoglycosides, cephalosporins], hydantoin, diuretics, methyldopa)",
    },
    { type: "static", subheading: true, text: "Falsely elevated in:" },
    {
      type: "static",
      text: "Diabetic ketoacidosis, administration of some cephalosporins (e.g. cefoxitin, cephalothin)",
    },
    { type: "static", subheading: true, text: "Decreased in:" },
    {
      type: "static",
      text: "Decreased muscle mass (including amputees and older persons), pregnancy, prolonged debilitation.",
    },
    { type: "signature", label: "Verified by", subtitle: "Medical Laboratory Technologist · SLMC Reg." },
  ],
} satisfies Template;

/**
 * Urine Microalbumin — Unawatuna Medical Centre's printed report. Urine creatinine and microalbumin
 * are entered; the albumin-to-creatinine ratio (ACR) is calculated:
 *   ACR (mg/g) = microalbumin (mg/l) / creatinine (mg/dl) × 100
 * (reproduces the printed 46.82 for 18.26 mg/l and 39.00 mg/dl). Values print with 2 decimals.
 */
export const urineMicroalbuminTemplate = {
  name: "Urine Microalbumin",
  version: 1,
  locked: true,
  sections: [
    {
      type: "patient_info",
      fields: ["name", "age", "gender", "referred_by", "specimen_no", "datetime", "source"],
      defaultSource: "Urine",
    },
    { type: "static", heading: true, text: "Urine Microalbumin" },
    {
      type: "results_table",
      style: "list",
      listHeader: { left: "TEST", right: "RESULT" },
      rows: [
        { key: "ucr", test: "Urine Creatinine", unit: "mg/dl", decimals: 2 },
        { key: "umalb", test: "Urine Microalbumin", unit: "mg/l", decimals: 2 },
        {
          key: "acr",
          test: "Urine Microalbumin Creatinine Ratio",
          unit: "mg/g",
          formula: "umalb / ucr * 100",
          decimals: 2,
        },
      ],
    },
    { type: "static", heading: true, text: "Reference Range" },
    { type: "static", text: "Normal  :  < 20" },
    { type: "static", text: "Microalbuminuria  :  20 - 299" },
    { type: "static", text: "Proteinuria  :  >= 300" },
    { type: "signature", label: "Verified by", subtitle: "Medical Laboratory Technologist · SLMC Reg." },
  ],
} satisfies Template;

/**
 * Lipid Profile — Unawatuna Medical Centre's printed report. Total cholesterol, HDL and triglycerides
 * are entered; the rest is calculated (Friedewald):
 *   VLDL = TG / 5      LDL = Total − HDL − VLDL      Ratio = Total / HDL
 * (reproduces the printed 19.2 / 64.8 / 2.40 for 144 / 60 / 96). Friedewald is not valid when
 * TG > 400 mg/dl. Below the results, the lab's fixed lipid-fraction risk chart.
 */
export const lipidProfileTemplate = {
  name: "Lipid Profile",
  version: 1,
  locked: true,
  sections: [
    { type: "patient_info", fields: ["name", "age", "gender", "referred_by", "specimen_no", "datetime", "source"] },
    { type: "static", heading: true, text: "Lipid Profile" },
    {
      type: "results_table",
      style: "ranged",
      listHeader: { left: "CHEMISTRY", right: "RESULT" },
      rangeHeader: "REF.RANGE",
      rows: [
        { key: "tc", test: "Cholesterol Total", unit: "mg/dl", ref_low: 120, ref_high: 200, ref_text: "120-200 mg/dl" },
        {
          key: "hdl",
          test: "Cholesterol HDL",
          unit: "mg/dl",
          ref_low: 30,
          ref_high: 75,
          ref_text: "30-75 mg/dl",
          decimals: 1,
        },
        { key: "tg", test: "Triglycerides", unit: "mg/dl", ref_low: 36, ref_high: 165, ref_text: "36-165 mg/dl" },
        {
          key: "ldl",
          test: "Cholesterol LDL",
          unit: "mg/dl",
          ref_high: 130,
          ref_text: "<130 mg/dl",
          formula: "tc - hdl - vldl",
          decimals: 1,
        },
        {
          key: "vldl",
          test: "Cholesterol VLDL",
          unit: "mg/dl",
          ref_low: 10,
          ref_high: 40,
          ref_text: "(10-40) mg/dl",
          formula: "tg / 5",
          decimals: 1,
        },
        // Only the upper bound flags: a low ratio is favourable, not abnormal.
        {
          key: "ratio",
          test: "Cholesterol/HDL Ratio",
          ref_high: 5,
          ref_text: "(3.0-5.0)",
          formula: "tc / hdl",
          decimals: 2,
        },
      ],
    },
    {
      type: "table",
      columns: ["LIPID FRACTIONS", "", "PROGNOSTICALLY FAVOURABLE", "STANDARD RISK LEVEL", "RISK INDICATOR"],
      widths: [26, 12, 22, 22, 18],
      rows: [
        ["Total Cholesterol", "", "220", "226-260", ">266"],
        ["HDL (mg/100ml)", "Men\nWomen", ">55\n>65", "35-55\n45-65", "<35\n<45"],
        ["LDL (mg/100ml)", "Men\nWomen", "<150", "150-190", ">190"],
        ["Cholesterol/HDL Ratio", "Men\nWomen", "<3.8\n<3.1", "3.8-5.9\n3.1-4.5", ">5.9\n>4.5"],
      ],
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
  locked: true,
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
