import { describe, it, expect } from "vitest";
import { reportDataToFormInputs } from "@/lib/reports/form";
import { computeResults, type ReportData } from "@/lib/report-engine/report-data";
import { fbcTemplate } from "@/lib/report-engine/examples";
import type { Template } from "@/lib/report-engine/template";

describe("reportDataToFormInputs", () => {
  it("flattens stored FBC data back into the raw form maps", () => {
    const data: ReportData = {
      patient_info: { name: "Nimal", age: 42, gender: "male" },
      results: computeResults(fbcTemplate, { hb: 14, plt: 420 }),
      comments: "Repeat in 3 months",
    };

    const inputs = reportDataToFormInputs(fbcTemplate, data);

    // patient_info values stringified (age number → "42"); absent ref_doctor omitted.
    expect(inputs.patientInfo).toEqual({ name: "Nimal", age: "42", gender: "male" });
    // result values stringified; unfilled wbc omitted (computeResults skipped it).
    expect(inputs.results).toEqual({ hb: "14", plt: "420" });
    // textarea value carried through.
    expect(inputs.values).toEqual({ comments: "Repeat in 3 months" });
  });

  it("round-trips: a draft's inputs re-coerce to the same stored data", () => {
    const inputs = reportDataToFormInputs(fbcTemplate, {
      patient_info: { name: "A", age: 30 },
      results: computeResults(fbcTemplate, { hb: 10 }),
    });
    // The numeric strings re-parse to the same flagged result the service would store.
    expect(Number(inputs.results.hb)).toBe(10);
    expect(computeResults(fbcTemplate, { hb: Number(inputs.results.hb) }).hb).toEqual({ value: 10, flag: "low" });
  });

  it("surfaces only keys the snapshot declares (ignores stray stored keys)", () => {
    const tpl: Template = {
      name: "T",
      version: 1,
      sections: [{ type: "field", key: "method", label: "Method", inputType: "text" }],
    };
    const inputs = reportDataToFormInputs(tpl, { method: "Manual", legacy_field: "x" } as ReportData);
    expect(inputs.values).toEqual({ method: "Manual" });
  });

  it("omits empty-string and null values", () => {
    const tpl: Template = {
      name: "T",
      version: 1,
      sections: [
        { type: "field", key: "a", label: "A", inputType: "text" },
        { type: "textarea", key: "b", label: "B" },
      ],
    };
    const inputs = reportDataToFormInputs(tpl, { a: "", b: null } as unknown as ReportData);
    expect(inputs.values).toEqual({});
  });
});
