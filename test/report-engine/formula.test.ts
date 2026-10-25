import { describe, expect, it } from "vitest";
import { evaluateFormula, parseFormula, roundTo } from "@/lib/report-engine/formula";
import { computeResults, formatResult, validateReportData } from "@/lib/report-engine/report-data";
import { templateSchema } from "@/lib/report-engine/template";
import {
  fullBloodCountTemplate,
  serumCreatinineTemplate,
  urineMicroalbuminTemplate,
  lipidProfileTemplate,
  urineFullReportTemplate,
  cholesterolTemplate,
  esrTemplate,
  renalFunctionTemplate,
  bloodSugarSeriesTemplate,
  liverProfileTemplate,
  randomBloodSugarTemplate,
  postprandialBloodSugarTemplate,
} from "@/lib/report-engine/examples";

describe("formula parser", () => {
  it("respects precedence, parentheses and unary minus", () => {
    expect(evaluateFormula(parseFormula("2 + 3 * 4"), {})).toBe(14);
    expect(evaluateFormula(parseFormula("(2 + 3) * 4"), {})).toBe(20);
    expect(evaluateFormula(parseFormula("-a / 2"), { a: 3 })).toBe(-1.5);
  });

  it("returns null for missing refs and divide by zero", () => {
    expect(evaluateFormula(parseFormula("a * 2"), {})).toBeNull();
    expect(evaluateFormula(parseFormula("a / b"), { a: 1, b: 0 })).toBeNull();
  });

  it("rejects anything that isn't arithmetic", () => {
    expect(() => parseFormula("a; process.exit()")).toThrow();
    expect(() => parseFormula("a +")).toThrow();
    expect(() => parseFormula("(a")).toThrow();
  });

  it("rounds half away from zero", () => {
    expect(roundTo(2.45, 1)).toBe(2.5);
    expect(roundTo(2597, 0)).toBe(2597);
  });
});

describe("template validation of formulas", () => {
  const tpl = (rows: object[]) => ({ name: "T", version: 1, sections: [{ type: "results_table", rows }] });

  it("rejects unknown refs and cycles", () => {
    expect(templateSchema.safeParse(tpl([{ key: "a", test: "A", formula: "b * 2" }])).success).toBe(false);
    expect(
      templateSchema.safeParse(
        tpl([
          { key: "a", test: "A", formula: "b" },
          { key: "b", test: "B", formula: "a" },
        ]),
      ).success,
    ).toBe(false);
  });

  it("accepts the Full Blood Count template and keeps it locked through parsing", () => {
    const parsed = templateSchema.safeParse(fullBloodCountTemplate);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.locked).toBe(true);
  });
});

describe("Full Blood Count calculations", () => {
  const entered = { wbc: 4900, neut: 53, lymph: 42, eos: 3, mono: 2, baso: 0, hb: 10.8, plt: 248000 };

  it("derives absolute counts, RBC and the indices from the manual inputs", () => {
    const out = computeResults(fullBloodCountTemplate, { ...entered, pcv: 30.4 });
    expect([out.neut.value2, out.lymph.value2, out.eos.value2, out.mono.value2, out.baso.value2]).toEqual([
      2597, 2058, 147, 98, 0,
    ]);
    // Matches the printed report (RBC 3.4, MCHC 35.5, MCV 89.4); MCH prints 31.7 there, 31.8 here.
    expect(out.rbc).toEqual({ value: 3.4, flag: "low" });
    expect(out.mchc).toEqual({ value: 35.5, flag: "normal" });
    expect(out.mcv).toEqual({ value: 89.4, flag: "normal" });
    expect(out.mch).toEqual({ value: 31.8, flag: "normal" });
    expect(out.hb.flag).toBe("low");
  });

  it("ignores typed values for calculated rows and leaves them blank until inputs exist", () => {
    const out = computeResults(fullBloodCountTemplate, { hb: 10.8, mchc: 99 });
    expect(out.mchc).toBeUndefined();
    expect(out.rbc).toBeUndefined();
  });

  it("produces data that validates against the template", () => {
    const results = computeResults(fullBloodCountTemplate, { ...entered, pcv: 30 });
    expect(validateReportData(fullBloodCountTemplate, { results }).success).toBe(true);
  });
});

describe("Serum Creatinine eGFR (CKD-EPI 2021)", () => {
  const egfr = (scr: number, age: number, gender: string) =>
    computeResults(serumCreatinineTemplate, { scr }, { age, gender }).egfr;

  // Reference values computed independently from the published equation.
  it("uses the max() branch above κ (Scr 1.32, 67): male 59.12, female 44.25", () => {
    expect(egfr(1.32, 67, "male")).toEqual({ value: 59.12, flag: "low" });
    expect(egfr(1.32, 67, "female")).toEqual({ value: 44.25, flag: "low" });
    expect(formatResult(59.1, { decimals: 2 })).toBe("59.10");
  });

  it("uses the min() branch below κ: female Scr 0.6 → 116.30, male Scr 0.8 → 114.74 (age 40)", () => {
    expect(egfr(0.6, 40, "female")?.value).toBe(116.3);
    expect(egfr(0.8, 40, "male")?.value).toBe(114.74);
  });

  it("leaves eGFR blank when age or sex is unknown", () => {
    expect(computeResults(serumCreatinineTemplate, { scr: 1.32 }, { gender: "male" }).egfr).toBeUndefined();
    expect(computeResults(serumCreatinineTemplate, { scr: 1.32 }, { age: 67 }).egfr).toBeUndefined();
  });

  it("supports min/max and rejects other functions", () => {
    expect(evaluateFormula(parseFormula("min(3, 1, 2) + max(1, 5)"), {})).toBe(6);
    expect(() => parseFormula("abs(1)")).toThrow();
    expect(() => parseFormula("min(1, 2")).toThrow();
  });

  it("gives ^ precedence over unary minus and * (right-associative)", () => {
    expect(evaluateFormula(parseFormula("-2 ^ 2"), {})).toBe(-4);
    expect(evaluateFormula(parseFormula("2 * 3 ^ 2"), {})).toBe(18);
    expect(evaluateFormula(parseFormula("2 ^ 3 ^ 2"), {})).toBe(512);
    expect(evaluateFormula(parseFormula("4 ^ -0.5"), {})).toBe(0.5);
  });
});

describe("Urine Microalbumin ACR", () => {
  it("matches the printed report: 18.26 mg/l ÷ 39.00 mg/dl × 100 → 46.82 mg/g", () => {
    const out = computeResults(urineMicroalbuminTemplate, { ucr: "39", umalb: "18.26" });
    expect(out.acr.value).toBe(46.82);
    expect(formatResult(out.ucr.value, { decimals: 2 })).toBe("39.00");
  });

  it("leaves the ratio blank until both values are entered, and on zero creatinine", () => {
    expect(computeResults(urineMicroalbuminTemplate, { umalb: 18.26 }).acr).toBeUndefined();
    expect(computeResults(urineMicroalbuminTemplate, { ucr: 0, umalb: 18.26 }).acr).toBeUndefined();
  });
});

describe("Lipid Profile (Friedewald)", () => {
  it("matches the printed report: 144 / 60 / 96 → VLDL 19.2, LDL 64.8, ratio 2.40", () => {
    const out = computeResults(lipidProfileTemplate, { tc: "144", hdl: "60", tg: "96" });
    expect(out.vldl).toEqual({ value: 19.2, flag: "normal" });
    expect(out.ldl).toEqual({ value: 64.8, flag: "normal" });
    expect(out.ratio).toEqual({ value: 2.4, flag: "normal" }); // a low ratio is not flagged
    expect(formatResult(out.ratio.value, { decimals: 2 })).toBe("2.40");
    expect(formatResult(out.hdl.value, { decimals: 1 })).toBe("60.0");
  });

  it("flags a high LDL and ratio", () => {
    const out = computeResults(lipidProfileTemplate, { tc: 280, hdl: 40, tg: 150 });
    expect(out.ldl).toEqual({ value: 210, flag: "high" });
    expect(out.ratio).toEqual({ value: 7, flag: "high" });
  });
});

describe("table block validation", () => {
  const tpl = (section: object) => ({ name: "T", version: 1, sections: [section] });

  it("rejects rows or widths that don't match the columns", () => {
    expect(templateSchema.safeParse(tpl({ type: "table", columns: ["A", "B"], rows: [["x"]] })).success).toBe(false);
    expect(
      templateSchema.safeParse(tpl({ type: "table", columns: ["A", "B"], widths: [1], rows: [["x", "y"]] })).success,
    ).toBe(false);
    expect(templateSchema.safeParse(tpl({ type: "table", columns: ["A", "B"], rows: [["x", "y"]] })).success).toBe(
      true,
    );
  });
});

describe("Urine Full Report", () => {
  it("is a valid template whose rows are all free text", () => {
    expect(templateSchema.safeParse(urineFullReportTemplate).success).toBe(true);
    const rows = urineFullReportTemplate.sections.flatMap((s) => (s.type === "results_table" ? s.rows : []));
    expect(rows.every((r) => r.value_type === "text")).toBe(true);
  });

  it("stores entries verbatim (trimmed), keeps 1.030's zero, and skips blanks", () => {
    const out = computeResults(urineFullReportTemplate, {
      colour: " Straw ",
      sg: "1.030",
      pus: "1 to 2",
      crystals: "",
    });
    expect(out.colour).toEqual({ value: "Straw" });
    expect(out.sg).toEqual({ value: "1.030" });
    expect(out.pus).toEqual({ value: "1 to 2" });
    expect(out.crystals).toBeUndefined();
    expect(validateReportData(urineFullReportTemplate, { results: out }).success).toBe(true);
  });
});

describe("Cholesterol", () => {
  it("flags against 150-200 for the REMARKS column, showing 1 decimal (190.0)", () => {
    expect(computeResults(cholesterolTemplate, { tc: "190" }).tc).toEqual({ value: 190, flag: "normal" });
    expect(computeResults(cholesterolTemplate, { tc: "215" }).tc.flag).toBe("high");
    expect(computeResults(cholesterolTemplate, { tc: "140" }).tc.flag).toBe("low");
    expect(formatResult(190, { decimals: 1 })).toBe("190.0");
  });
});

describe("ESR, Renal Function Test, Blood Sugar Series", () => {
  it("are valid templates", () => {
    for (const t of [esrTemplate, renalFunctionTemplate, bloodSugarSeriesTemplate]) {
      expect(templateSchema.safeParse(t).success).toBe(true);
    }
  });

  it("flags the renal profile from the printed report against its ranges", () => {
    const out = computeResults(renalFunctionTemplate, {
      urea: 26,
      scr: 1.48,
      uric: 6.7,
      ca: 2.06,
      phos: 2.6,
      na: 139.94,
      k: 4.09,
      cl: 99.21,
    });
    expect(out.scr.flag).toBe("high");
    expect(out.ca.flag).toBe("low");
    expect([out.urea, out.uric, out.phos, out.na, out.k, out.cl].every((e) => e.flag === "normal")).toBe(true);
    expect(formatResult(4.09, { decimals: 2 })).toBe("4.09");
  });

  it("only flags the fasting value in the blood sugar series", () => {
    const out = computeResults(bloodSugarSeriesTemplate, { fbs: 130, pp_breakfast: 250 });
    expect(out.fbs.flag).toBe("high");
    expect(out.pp_breakfast.flag).toBe("normal"); // no range → never flagged
  });
});

describe("Liver Profile Test", () => {
  it("calculates globulin = total protein − albumin, and flags the printed results", () => {
    const out = computeResults(liverProfileTemplate, {
      tbil: 2.59,
      alp: 86.8,
      ast: 19.4,
      alt: 33,
      ggt: 88.5,
      tp: 5.4,
      alb: 4.5,
    });
    expect(out.glob).toEqual({ value: 0.9, flag: "normal" }); // no range on the paper → never flagged
    expect(out.tbil.flag).toBe("high");
    expect(out.ggt.flag).toBe("high");
    expect(out.tp.flag).toBe("low");
    expect([out.alp, out.ast, out.alt, out.alb].every((e) => e.flag === "normal")).toBe(true);
  });

  it("ignores a typed globulin and leaves it blank until both proteins are entered", () => {
    expect(computeResults(liverProfileTemplate, { tp: 7, glob: 99 }).glob).toBeUndefined();
  });
});

describe("Random and Postprandial Blood Sugar", () => {
  it("matches the printed reports: RBS 111.0 → 6.1 mmol/l, PPBS 125.0 → 6.9 mmol/l + urine sugar Nil", () => {
    const rbs = computeResults(randomBloodSugarTemplate, { rbs: "111" });
    expect(rbs.rbs).toEqual({ value: 111, flag: "normal", value2: 6.1 });
    expect(formatResult(111, { decimals: 1 })).toBe("111.0");

    const pp = computeResults(postprandialBloodSugarTemplate, { ppbs: "125", ppus: "Nil" });
    expect(pp.ppbs.value2).toBe(6.9);
    expect(pp.ppus).toEqual({ value: "Nil" });
  });

  it("flags random blood sugar against 65-140", () => {
    expect(computeResults(randomBloodSugarTemplate, { rbs: 180 }).rbs.flag).toBe("high");
  });
});
