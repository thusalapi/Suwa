import { describe, it, expect } from "vitest";
import { templateSchema, parseTemplate } from "@/lib/report-engine/template";
import { computeResults, validateReportData } from "@/lib/report-engine/report-data";
import { fastingBloodSugarTemplate, bloodGroupingTemplate } from "@/lib/report-engine/examples";

describe("house-style templates", () => {
  it("the seeded lab templates are schema-valid", () => {
    expect(() => parseTemplate(fastingBloodSugarTemplate)).not.toThrow();
    expect(() => parseTemplate(bloodGroupingTemplate)).not.toThrow();
  });
});

describe("computeResults — dual unit (factor2)", () => {
  it("derives and stores the second-unit value, flagging normally", () => {
    const out = computeResults(fastingBloodSugarTemplate, { fbs: "121.0" });
    // 121 × 0.0555 = 6.7155 → rounded to one decimal; no reference range ⇒ normal.
    expect(out.fbs).toEqual({ value: 121, flag: "normal", value2: 6.7 });
  });

  it("validates the stored dual-unit shape", () => {
    const data = {
      patient_info: { name: "MR.W.M.SUNIL", age: 65, gender: "male", source: "Blood", specimen_no: "3032" },
      results: { fbs: { value: 121, flag: "normal", value2: 6.7 } },
    };
    expect(validateReportData(fastingBloodSugarTemplate, data).success).toBe(true);
  });
});

describe("computeResults — qualitative (value_type: text)", () => {
  it("stores the trimmed string with no flag", () => {
    const out = computeResults(bloodGroupingTemplate, { blood_group: "  B Positive  " });
    expect(out.blood_group).toEqual({ value: "B Positive" });
    expect(out.blood_group.flag).toBeUndefined();
  });

  it("validates the stored text shape", () => {
    const data = {
      patient_info: { name: "Mr.A.L.Danushka", age: 20 },
      results: { blood_group: { value: "B Positive" } },
    };
    expect(validateReportData(bloodGroupingTemplate, data).success).toBe(true);
  });
});

describe("results_table validation", () => {
  it("rejects factor2 without unit2", () => {
    const bad = {
      name: "T",
      version: 1,
      sections: [{ type: "results_table", rows: [{ key: "a", test: "A", factor2: 0.5 }] }],
    };
    expect(templateSchema.safeParse(bad).success).toBe(false);
  });

  it("accepts a list-style table with a header", () => {
    const ok = {
      name: "T",
      version: 1,
      sections: [
        {
          type: "results_table",
          style: "list",
          listHeader: { left: "Chemistry", right: "Result" },
          rows: [{ key: "a", test: "A", unit: "mg/dl", unit2: "mmol/l", factor2: 0.0555 }],
        },
      ],
    };
    expect(templateSchema.safeParse(ok).success).toBe(true);
  });
});
