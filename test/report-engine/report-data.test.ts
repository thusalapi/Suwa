import { describe, it, expect } from "vitest";
import { computeResults, validateReportData } from "@/lib/report-engine/report-data";
import { fbcTemplate } from "@/lib/report-engine/examples";
import type { Template } from "@/lib/report-engine/template";

// A template with a critical bound and a required field, for the edge cases the FBC fixture lacks.
const tpl: Template = {
  name: "T",
  version: 1,
  sections: [
    { type: "results_table", rows: [{ key: "k", test: "K", ref_low: 3.5, ref_high: 5.5, critical_low: 2.5 }] },
    { type: "field", key: "method", label: "Method", inputType: "text", required: true },
  ],
};

describe("computeResults", () => {
  it("classifies each entered value against its row range", () => {
    const out = computeResults(fbcTemplate, { hb: 10, wbc: 7, plt: 420 });
    expect(out.hb).toEqual({ value: 10, flag: "low" });
    expect(out.wbc).toEqual({ value: 7, flag: "normal" });
    expect(out.plt).toEqual({ value: 420, flag: "high" });
  });

  it("applies critical bounds", () => {
    expect(computeResults(tpl, { k: 2 }).k).toEqual({ value: 2, flag: "critical_low" });
  });

  it("skips blank, null, undefined, and NaN entries", () => {
    const out = computeResults(fbcTemplate, { hb: 14, wbc: undefined, plt: NaN });
    expect(out).toEqual({ hb: { value: 14, flag: "normal" } });
  });

  it("ignores values for keys not in the template", () => {
    expect(computeResults(fbcTemplate, { not_a_row: 5 } as never)).toEqual({});
  });
});

describe("validateReportData", () => {
  it("accepts well-formed partial data", () => {
    const data = { results: { hb: { value: 14, flag: "normal" } }, comments: "looks fine" };
    expect(validateReportData(fbcTemplate, data).success).toBe(true);
  });

  it("rejects unknown top-level keys (strict)", () => {
    const res = validateReportData(fbcTemplate, { surprise: 1 });
    expect(res.success).toBe(false);
  });

  it("rejects a malformed result value", () => {
    const res = validateReportData(fbcTemplate, { results: { hb: { value: "x", flag: "normal" } } });
    expect(res.success).toBe(false);
  });

  it("rejects an invalid flag enum value", () => {
    const res = validateReportData(fbcTemplate, { results: { hb: { value: 14, flag: "bogus" } } });
    expect(res.success).toBe(false);
  });

  it("enforces a required field", () => {
    expect(validateReportData(tpl, {}).success).toBe(false);
    expect(validateReportData(tpl, { method: "manual" }).success).toBe(true);
  });
});
