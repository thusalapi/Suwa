import type { ResultRow, Template } from "./template";

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

/** The lab's standard footnote, printed (as a `note`) on several of its reports. */
const LAB_NOTE =
  "Note:  1. The values will vary from one laboratory to another.\n" +
  "          2. Laboratory values depend on the age, sex and time of collecting the samples, and may vary accordingly.\n" +
  "          3. Laboratory reports should not be interpreted in isolation. They should always be correlated with clinical findings and other medical reports.";

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
      // Printed with 1 decimal (101.0 mg/dl), as on the lab's report.
      rows: [{ key: "fbs", test: "Fasting Blood Sugar", unit: "mg/dl", unit2: "mmol/l", factor2: 0.0555, decimals: 1 }],
    },
    { type: "static", heading: true, text: "EXPECTED VALUES" },
    { type: "static", text: "70 - 100 mg/dl  :  Normal" },
    { type: "static", text: "101 - 125 mg/dl  :  Impaired" },
    { type: "static", text: ">= 126 mg/dl  :  High" },
    { type: "static", note: true, text: LAB_NOTE },
    { type: "signature", label: "Verified by", subtitle: "Medical Laboratory Technologist · SLMC Reg." },
  ],
} satisfies Template;

/**
 * Cholesterol (total) — Unawatuna Medical Centre's printed report. Only the result is entered; the
 * REMARKS column (Normal / Low / High) follows from the 150-200 mg/dl range.
 */
export const cholesterolTemplate = {
  name: "Cholesterol",
  version: 1,
  locked: true,
  sections: [
    { type: "patient_info", fields: ["name", "age", "gender", "referred_by", "specimen_no", "datetime", "source"] },
    { type: "static", heading: true, text: "Cholesterol" },
    {
      type: "results_table",
      style: "ranged",
      listHeader: { left: "CHEMISTRY", right: "RESULT" },
      rangeHeader: "REF.RANGE",
      remarksHeader: "REMARKS",
      rows: [
        {
          key: "tc",
          test: "Total Cholesterol",
          unit: "mg/dl",
          ref_low: 150,
          ref_high: 200,
          ref_text: "150 - 200 mg/dl",
          decimals: 1,
        },
      ],
    },
    { type: "static", note: true, text: LAB_NOTE },
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
 * Urine Full Report (UFR) — Unawatuna Medical Centre's printed report. Every value is entered by
 * hand and most are words ("Straw", "Nil", "1 to 2"), so the rows are text with typing suggestions;
 * nothing is calculated or flagged. Sp. gravity and pH are text too, so "1.030" keeps its zero.
 */
const GRADES = ["Nil", "Trace", "+", "++", "+++", "++++"];
const PER_HPF = [
  "Nil",
  "Occasional",
  "0 to 1",
  "1 to 2",
  "2 to 3",
  "3 to 5",
  "5 to 10",
  "10 to 15",
  "15 to 20",
  "Field full",
];

export const urineFullReportTemplate = {
  name: "Urine Full Report",
  version: 1,
  locked: true,
  sections: [
    {
      type: "patient_info",
      fields: ["name", "age", "gender", "referred_by", "specimen_no", "datetime", "source"],
      defaultSource: "Urine",
    },
    { type: "static", heading: true, text: "Urine Full Report" },
    {
      type: "results_table",
      style: "list",
      rows: [
        {
          key: "colour",
          test: "Colour",
          value_type: "text",
          suggestions: ["Straw", "Pale Yellow", "Yellow", "Dark Yellow", "Amber", "Red", "Brown"],
        },
        {
          key: "appearance",
          test: "Appearance",
          value_type: "text",
          suggestions: ["Clear", "Slightly Turbid", "Turbid"],
        },
        { key: "reaction", test: "Reaction", value_type: "text", suggestions: ["Acidic", "Neutral", "Alkaline"] },
        {
          key: "sg",
          test: "Sp. Gravity",
          value_type: "text",
          suggestions: ["1.005", "1.010", "1.015", "1.020", "1.025", "1.030"],
        },
        { key: "protein", test: "Protein", value_type: "text", suggestions: GRADES },
        { key: "sugar", test: "Sugar", value_type: "text", suggestions: GRADES },
        { key: "acetone", test: "Acetone", value_type: "text", suggestions: ["Negative", "Positive"] },
        { key: "bile", test: "Bile Pigments", value_type: "text", suggestions: ["Negative", "Positive"] },
        { key: "urobilinogen", test: "Urobilinogen", value_type: "text", suggestions: ["+ Normal", "Increased"] },
        {
          key: "blood",
          test: "Occult Blood",
          value_type: "text",
          suggestions: ["Negative", "Trace", "+", "++", "+++"],
        },
        {
          key: "leucocytes",
          test: "Leucocytes",
          value_type: "text",
          suggestions: ["Negative", "Trace", "+", "++", "+++"],
        },
        {
          key: "ph",
          test: "pH",
          value_type: "text",
          suggestions: ["5", "5.5", "6", "6.5", "7", "7.5", "8", "8.5"],
        },
      ],
    },
    { type: "static", heading: true, text: "DEPOSITS" },
    {
      type: "results_table",
      style: "list",
      rows: [
        { key: "pus", test: "Pus Cells", unit: "/H.P.F", value_type: "text", suggestions: PER_HPF },
        { key: "rbc", test: "Red Cells", unit: "/H.P.F", value_type: "text", suggestions: PER_HPF },
        { key: "epithelial", test: "Epithelial Cells", value_type: "text", suggestions: GRADES },
        { key: "casts", test: "Casts", value_type: "text", suggestions: ["Nil"] },
        { key: "crystals", test: "Crystals", value_type: "text", suggestions: ["Nil"] },
        { key: "organisms", test: "Organisms", value_type: "text", suggestions: ["Nil"] },
      ],
    },
    { type: "signature", label: "Verified by", subtitle: "Medical Laboratory Technologist · SLMC Reg." },
  ],
} satisfies Template;

/**
 * ESR — Unawatuna Medical Centre's printed report. Only the result is entered. The reference
 * range depends on sex and age, so it is printed as a block below (no flag on the result).
 */
export const esrTemplate = {
  name: "ESR",
  version: 1,
  locked: true,
  sections: [
    { type: "patient_info", fields: ["name", "age", "gender", "referred_by", "specimen_no", "datetime", "source"] },
    { type: "static", heading: true, text: "E.S.R" },
    {
      type: "results_table",
      style: "list",
      rows: [{ key: "esr", test: "Erythrocytes Sedimentation Rate", unit: "mm (1st Hour)" }],
    },
    { type: "static", heading: true, text: "REFERENCE RANGE" },
    { type: "static", subheading: true, text: "Male :" },
    { type: "static", text: "Age < 50  :  0 - 15 mm 1st Hour" },
    { type: "static", text: "Age > 50  :  0 - 20 mm 1st Hour" },
    { type: "static", subheading: true, text: "Female :" },
    { type: "static", text: "Age < 50  :  0 - 25 mm 1st Hour" },
    { type: "static", text: "Age > 50  :  0 - 30 mm 1st Hour" },
    { type: "signature", label: "Verified by", subtitle: "Medical Laboratory Technologist · SLMC Reg." },
  ],
} satisfies Template;

/**
 * Renal Function Test — Unawatuna Medical Centre's printed report. All eight results are entered and
 * flagged against the printed ranges; values print with the lab's usual decimals.
 */
export const renalFunctionTemplate = {
  name: "Renal Function Test",
  version: 1,
  locked: true,
  sections: [
    { type: "patient_info", fields: ["name", "age", "gender", "referred_by", "specimen_no", "datetime", "source"] },
    { type: "static", heading: true, text: "RENAL FUNCTION TEST" },
    {
      type: "results_table",
      style: "ranged",
      listHeader: { left: "TEST", right: "RESULT" },
      rangeHeader: "REF.RANGE",
      rows: [
        { key: "urea", test: "Serum Urea", unit: "mg/dl", ref_low: 10, ref_high: 40 },
        { key: "scr", test: "Serum Creatinine", unit: "mg/dl", ref_low: 0.9, ref_high: 1.3, decimals: 2 },
        {
          key: "uric",
          test: "Serum Uric Acid",
          unit: "mg/dl",
          ref_low: 3.4,
          ref_high: 7,
          ref_text: "3.4 - 7.0",
          decimals: 1,
        },
        { key: "ca", test: "Serum Calcium", unit: "mg/dl", ref_low: 8.1, ref_high: 10.4, decimals: 2 },
        {
          key: "phos",
          test: "Serum Phosphorus (Inorganic)",
          unit: "mg/dl",
          ref_low: 2.5,
          ref_high: 4.9,
          decimals: 1,
        },
        { key: "na", test: "Serum Na^+", unit: "mmol/l", ref_low: 135, ref_high: 145, decimals: 2 },
        { key: "k", test: "Serum K^+", unit: "mmol/l", ref_low: 3.5, ref_high: 5.3, decimals: 2 },
        { key: "cl", test: "Serum Cl^-", unit: "mmol/l", ref_low: 95, ref_high: 111, decimals: 2 },
      ],
    },
    { type: "signature", label: "Verified by", subtitle: "Medical Laboratory Technologist · SLMC Reg." },
  ],
} satisfies Template;

/**
 * Blood Sugar Series Test — Unawatuna Medical Centre's printed report: six timed glucose readings,
 * all entered. Only the fasting value has a reference range; the rest print "-".
 */
export const bloodSugarSeriesTemplate = {
  name: "Blood Sugar Series Test",
  version: 1,
  locked: true,
  sections: [
    { type: "patient_info", fields: ["name", "age", "gender", "referred_by", "specimen_no", "datetime", "source"] },
    { type: "static", heading: true, text: "BLOOD SUGAR SERIES TEST" },
    {
      type: "results_table",
      style: "ranged",
      listHeader: { left: "TEST", right: "RESULT" },
      rangeHeader: "REF. RANGE",
      rows: [
        {
          key: "fbs",
          test: "Fasting Blood Sugar",
          unit: "mg/dl",
          ref_low: 75,
          ref_high: 120,
          ref_text: "75 - 120 mg/dl",
        },
        { key: "pp_breakfast", test: "Post Prandial Blood Sugar (Post Breakfast)", unit: "mg/dl", ref_text: "-" },
        { key: "pre_lunch", test: "Pre. Lunch Blood Sugar", unit: "mg/dl", ref_text: "-" },
        { key: "pp_lunch", test: "Post Prandial Blood Sugar (Post Lunch)", unit: "mg/dl", ref_text: "-" },
        { key: "pre_dinner", test: "Pre. Dinner Blood Sugar", unit: "mg/dl", ref_text: "-" },
        { key: "pp_dinner", test: "Post Prandial Blood Sugar (Post Dinner)", unit: "mg/dl", ref_text: "-" },
      ],
    },
    { type: "signature", label: "Verified by", subtitle: "Medical Laboratory Technologist · SLMC Reg." },
  ],
} satisfies Template;

/**
 * Liver Profile Test — Unawatuna Medical Centre's printed report. Seven results are entered;
 * globulin is calculated: Globulin = Total Protein − Albumin (g/dl). The paper prints no range for it.
 */
export const liverProfileTemplate = {
  name: "Liver Profile Test",
  version: 1,
  locked: true,
  sections: [
    { type: "patient_info", fields: ["name", "age", "gender", "referred_by", "specimen_no", "datetime", "source"] },
    { type: "static", heading: true, text: "LIVER PROFILE TEST" },
    {
      type: "results_table",
      style: "ranged",
      listHeader: { left: "TEST TYPE", right: "RESULT" },
      rangeHeader: "REF.RANGE",
      rows: [
        {
          key: "tbil",
          test: "Total Bilirubin",
          unit: "mg/dl",
          ref_low: 0.2,
          ref_high: 1,
          ref_text: "0.2 - 1.0",
          decimals: 2,
        },
        { key: "alp", test: "S. Alkaline Phosphatase", unit: "u/l", ref_low: 40, ref_high: 130, decimals: 1 },
        { key: "ast", test: "SGOT (AST)", unit: "u/l", ref_high: 35, ref_text: "< 35", decimals: 1 },
        { key: "alt", test: "SGPT (ALT)", unit: "u/l", ref_high: 40, ref_text: "< 40", decimals: 1 },
        { key: "ggt", test: "Gamma GT", unit: "u/l", ref_high: 49, ref_text: "< 49", decimals: 1 },
        { key: "tp", test: "Total Protein", unit: "g/dl", ref_low: 6.6, ref_high: 8.8, decimals: 1 },
        { key: "alb", test: "Albumin", unit: "g/dl", ref_low: 3.5, ref_high: 5.2, decimals: 1 },
        { key: "glob", test: "Globulin", unit: "g/dl", formula: "tp - alb", decimals: 1 },
      ],
    },
    { type: "signature", label: "Verified by", subtitle: "Medical Laboratory Technologist · SLMC Reg." },
  ],
} satisfies Template;

/**
 * Random Blood Sugar — Unawatuna Medical Centre's printed report. Only the result is entered; mmol/l
 * is derived (× 0.0555) and printed in its own column beside the range (111.0 mg/dl → 6.1 mmol/l).
 */
export const randomBloodSugarTemplate = {
  name: "Random Blood Sugar",
  version: 1,
  locked: true,
  sections: [
    { type: "patient_info", fields: ["name", "age", "gender", "referred_by", "specimen_no", "datetime", "source"] },
    { type: "static", heading: true, text: "Random Blood Sugar" },
    {
      type: "results_table",
      style: "ranged",
      listHeader: { left: "CHEMISTRY", right: "RESULT" },
      rangeHeader: "REF.RANGE",
      rows: [
        {
          key: "rbs",
          test: "Random Blood Sugar",
          unit: "mg/dl",
          unit2: "mmol/l",
          factor2: 0.0555,
          ref_low: 65,
          ref_high: 140,
          ref_text: "65-140 mg/dl",
          decimals: 1,
        },
      ],
    },
    { type: "signature", label: "Verified by", subtitle: "Medical Laboratory Technologist · SLMC Reg." },
  ],
} satisfies Template;

/**
 * Postprandial Blood Sugar — Unawatuna Medical Centre's printed report, in the Fasting Blood Sugar
 * style: blood sugar entered (mmol/l derived), urine sugar entered as text, then the expected values.
 */
export const postprandialBloodSugarTemplate = {
  name: "Postprandial Blood Sugar",
  version: 1,
  locked: true,
  sections: [
    { type: "patient_info", fields: ["name", "age", "gender", "referred_by", "specimen_no", "datetime", "source"] },
    {
      type: "results_table",
      style: "list",
      title: "Postprandial Blood Sugar",
      listHeader: { left: "Chemistry", right: "Result" },
      rows: [
        {
          key: "ppbs",
          test: "Postprandial Blood Sugar",
          unit: "mg/dl",
          unit2: "mmol/l",
          factor2: 0.0555,
          decimals: 1,
        },
        { key: "ppus", test: "Postprandial Urine Sugar", value_type: "text", suggestions: GRADES },
      ],
    },
    { type: "static", heading: true, text: "EXPECTED VALUES" },
    { type: "static", text: "70 - 140 mg/dl  :  Normal" },
    { type: "static", text: "140 - 200 mg/dl  :  Impaired" },
    { type: "static", text: ">= 200 mg/dl  :  High" },
    { type: "signature", label: "Verified by", subtitle: "Medical Laboratory Technologist · SLMC Reg." },
  ],
} satisfies Template;

/**
 * The lab's one-test chemistry layout: CHEMISTRY | RESULT | REF.RANGE | REMARKS, where REMARKS
 * (Normal / Low / High) follows from the range. Used by the single-enzyme / single-analyte reports.
 */
function singleTestTemplate(name: string, heading: string, rows: ResultRow[]) {
  return {
    name,
    version: 1,
    locked: true,
    sections: [
      { type: "patient_info", fields: ["name", "age", "gender", "referred_by", "specimen_no", "datetime", "source"] },
      { type: "static", heading: true, text: heading },
      {
        type: "results_table",
        style: "ranged",
        listHeader: { left: "CHEMISTRY", right: "RESULT" },
        rangeHeader: "REF.RANGE",
        remarksHeader: "REMARKS",
        rows,
      },
      { type: "signature", label: "Verified by", subtitle: "Medical Laboratory Technologist · SLMC Reg." },
    ],
  } satisfies Template;
}

export const sgotTemplate = singleTestTemplate("SGOT (AST)", "Enzyme Assays", [
  { key: "ast", test: "S.G.O.T./A.S.T.", unit: "U/l", ref_high: 40, ref_text: "<40 U/l", decimals: 1 },
]);

export const amylaseTemplate = singleTestTemplate("Amylase", "Enzyme Assays", [
  { key: "amylase", test: "Amylase", unit: "U/l", ref_low: 25, ref_high: 125, ref_text: "25 - 125 U/l", decimals: 1 },
]);

export const uricAcidTemplate = singleTestTemplate("Uric Acid", "Uric Acid", [
  {
    key: "uric",
    test: "Uric Acid",
    unit: "mg/dl",
    ref_low: 3,
    ref_high: 6.5,
    ref_text: "3.0 - 6.5 mg/dl",
    decimals: 1,
  },
]);

export const gammaGtTemplate = singleTestTemplate("Gamma GT", "Gamma GT", [
  { key: "ggt", test: "Gamma GT", unit: "IU/l", ref_low: 6, ref_high: 50, ref_text: "6 - 50 IU/l", decimals: 1 },
]);

export const alkalinePhosphataseTemplate = singleTestTemplate("Alkaline Phosphatase", "Alkaline Phosphatase", [
  {
    key: "alp",
    test: "Alkaline Phosphatase",
    unit: "U/l",
    ref_low: 35,
    ref_high: 123,
    ref_text: "35-123 U/l",
    decimals: 1,
  },
]);

/** Bilirubin — total and direct entered; Indirect = Total − Direct (printed with no range). */
export const bilirubinTemplate = singleTestTemplate("Bilirubin", "Bilirubin", [
  {
    key: "tbil",
    test: "Total Bilirubin",
    unit: "mg/dl",
    ref_low: 0.3,
    ref_high: 1.2,
    ref_text: "0.3-1.2 mg/dl",
    decimals: 2,
  },
  { key: "dbil", test: "Direct Bilirubin", unit: "mg/dl", ref_high: 0.2, ref_text: "<0.2 mg/dl", decimals: 2 },
  { key: "ibil", test: "Indirect Bilirubin", unit: "mg/dl", formula: "tbil - dbil", decimals: 2 },
]);

/**
 * Total Protein — total protein and albumin entered; Globulin = Total − Albumin, and the A/G ratio
 * = Albumin / Globulin, cut off (not rounded) to 2 places as the lab prints it (3.70/3.40 → 1.08).
 * Units are g/dl throughout (the old printout said mg/dl for two rows; its ranges were g/dl).
 */
export const totalProteinTemplate = singleTestTemplate("Total Protein", "Total Protein", [
  {
    key: "tp",
    test: "Total Protein",
    unit: "g/dl",
    ref_low: 6.2,
    ref_high: 8.2,
    ref_text: "6.2 - 8.2 g/dl",
    decimals: 2,
  },
  { key: "alb", test: "Albumin", unit: "g/dl", ref_low: 3.5, ref_high: 5.3, ref_text: "3.5 - 5.3 g/dl", decimals: 2 },
  {
    key: "glob",
    test: "Globulin",
    unit: "g/dl",
    ref_low: 1.2,
    ref_high: 4.8,
    ref_text: "1.2 - 4.8 g/dl",
    formula: "tp - alb",
    decimals: 2,
  },
  { key: "ag", test: "A/G Ratio", formula: "trunc(alb / glob, 2)", decimals: 2 },
]);

/** Electrolytes — five flagged results plus pH (no range, so no remark), all printed to 2 decimals. */
export const electrolytesTemplate = singleTestTemplate("Electrolytes", "Electrolytes", [
  {
    key: "k",
    test: "Serum Potassium",
    unit: "mmol/L",
    ref_low: 3.5,
    ref_high: 5.5,
    ref_text: "3.5 - 5.5 mmol/L",
    decimals: 2,
  },
  {
    key: "na",
    test: "Serum Sodium",
    unit: "mmol/L",
    ref_low: 135,
    ref_high: 145,
    ref_text: "135-145 mmol/L",
    decimals: 2,
  },
  {
    key: "cl",
    test: "Serum Chloride",
    unit: "mmol/L",
    ref_low: 94,
    ref_high: 108,
    ref_text: "94-108 mmol/L",
    decimals: 2,
  },
  {
    key: "ica",
    test: "Ionized Calcium",
    unit: "mmol/L",
    ref_low: 1.1,
    ref_high: 1.4,
    ref_text: "1.1 - 1.4 mmol/L",
    decimals: 2,
  },
  {
    key: "tca",
    test: "Total Calcium",
    unit: "mmol/L",
    ref_low: 2.2,
    ref_high: 2.9,
    ref_text: "2.2 - 2.9 mmol/L",
    decimals: 2,
  },
  { key: "ph", test: "pH", decimals: 2 },
]);

/**
 * Glyco-Haemoglobin (HbA1c) — the result and the run's normal control are both entered; the
 * reference ranges are printed below. Specimen source defaults to Serum, as on the lab's report.
 */
export const glycoHaemoglobinTemplate = {
  name: "Glyco - Haemoglobin",
  version: 1,
  locked: true,
  sections: [
    {
      type: "patient_info",
      fields: ["name", "age", "gender", "referred_by", "specimen_no", "datetime", "source"],
      defaultSource: "Serum",
    },
    { type: "static", heading: true, text: "Glyco - Haemoglobin" },
    {
      type: "results_table",
      style: "list",
      listHeader: { left: "TEST", right: "RESULT" },
      rows: [
        { key: "hba1c", test: "Glyco - Haemoglobin", unit: "%", decimals: 2 },
        { key: "control", test: "Normal Control", unit: "%", decimals: 1 },
      ],
    },
    { type: "static", subheading: true, text: "Reference Range:" },
    { type: "static", text: "Less than 5.7%  -  Normal" },
    { type: "static", text: "5.7% to 6.4%  -  Impaired" },
    { type: "static", text: "6.5% or higher  -  High" },
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

/**
 * Search keywords for the "choose a report" picker: the short names the lab actually types
 * (PPBS, LFT, HbA1c…), keyed by template name. Applied to each seeded template as `aliases`.
 */
export const TEMPLATE_ALIASES: Record<string, string[]> = {
  "Full Blood Count": ["FBC", "CBC"],
  "Fasting Blood Sugar": ["FBS", "fasting sugar"],
  "Random Blood Sugar": ["RBS", "random sugar"],
  "Postprandial Blood Sugar": ["PPBS", "PPBG", "post prandial"],
  "Blood Sugar Series Test": ["BSS", "sugar series"],
  "Glyco - Haemoglobin": ["HbA1c", "A1c", "glycated", "glycosylated"],
  "Serum Creatinine": ["SCr", "eGFR", "creatinine"],
  "Urine Microalbumin": ["UACR", "ACR", "microalbumin"],
  "Urine Full Report": ["UFR", "urine"],
  "Lipid Profile": ["lipids", "LDL", "HDL", "triglycerides"],
  Cholesterol: ["TC", "total cholesterol"],
  "Liver Profile Test": ["LFT", "liver"],
  "Renal Function Test": ["RFT", "renal", "kidney"],
  ESR: ["sed rate", "sedimentation"],
  "SGOT (AST)": ["AST", "SGOT"],
  "Gamma GT": ["GGT", "GGTP"],
  "Alkaline Phosphatase": ["ALP"],
  Electrolytes: ["Na", "K", "sodium", "potassium", "chloride"],
  "Total Protein": ["TP", "albumin", "globulin", "A/G"],
  Bilirubin: ["SBR", "TBil"],
  "Uric Acid": ["UA", "urate"],
  Amylase: ["serum amylase"],
  "Blood Grouping & Rh": ["ABO", "blood group"],
};
