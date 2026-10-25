import { describe, expect, it } from "vitest";
import { evaluateFormula, parseFormula, roundTo } from "@/lib/report-engine/formula";
import { computeResults, formatResult, validateReportData } from "@/lib/report-engine/report-data";
import { templateSchema } from "@/lib/report-engine/template";
import { fullBloodCountTemplate, serumCreatinineTemplate } from "@/lib/report-engine/examples";

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
