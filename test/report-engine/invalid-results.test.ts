import { describe, it, expect } from "vitest";
import { computeResults, invalidNumericResults } from "@/lib/report-engine/report-data";
import { fbcTemplate, bloodGroupingTemplate } from "@/lib/report-engine/examples";

/**
 * A mistyped numeric result used to be dropped silently: `computeResults` skipped it, the report
 * saved, and the analyte rendered "-" with nothing to say a value had ever been entered. For a
 * lab result that is worse than refusing the write, which is what `invalidNumericResults` now
 * lets the service do.
 */
describe("invalidNumericResults", () => {
  it("returns nothing when every entered value is a number", () => {
    expect(invalidNumericResults(fbcTemplate, { hb: "14.2", wbc: "7", plt: "250" })).toEqual([]);
  });

  it("names the analyte behind a comma decimal", () => {
    // The case that started this: "12,1" is how a lot of people type 12.1.
    expect(invalidNumericResults(fbcTemplate, { hb: "12,1" })).toEqual(["Hemoglobin"]);
  });

  it("names an analyte whose value carries a stray unit", () => {
    expect(invalidNumericResults(fbcTemplate, { wbc: "7 x10^3" })).toEqual(["WBC"]);
  });

  it("names every offending analyte, not just the first", () => {
    expect(invalidNumericResults(fbcTemplate, { hb: "12,1", wbc: "abc", plt: "250" })).toEqual(["Hemoglobin", "WBC"]);
  });

  it("treats blank and whitespace-only entries as not-yet-filled, not invalid", () => {
    expect(invalidNumericResults(fbcTemplate, { hb: "", wbc: "   ", plt: undefined })).toEqual([]);
  });

  it("rejects Infinity, which passed the old NaN check", () => {
    // Number("Infinity") is not NaN, so it slipped through — and JSON.stringify(Infinity) is
    // `null`, so it would have been stored as a null value sitting next to a computed flag.
    expect(invalidNumericResults(fbcTemplate, { hb: "Infinity" })).toEqual(["Hemoglobin"]);
    expect(invalidNumericResults(fbcTemplate, { hb: "-Infinity" })).toEqual(["Hemoglobin"]);
    expect(invalidNumericResults(fbcTemplate, { hb: "1e999" })).toEqual(["Hemoglobin"]);
  });

  it("ignores qualitative rows, which accept any string", () => {
    expect(invalidNumericResults(bloodGroupingTemplate, { blood_group: "B Positive" })).toEqual([]);
  });

  it("ignores keys that aren't in the template", () => {
    expect(invalidNumericResults(fbcTemplate, { not_a_row: "nonsense" } as never)).toEqual([]);
  });
});

describe("computeResults no longer stores anything JSON can't represent", () => {
  it("skips a non-finite value instead of storing null beside a flag", () => {
    const out = computeResults(fbcTemplate, { hb: "Infinity", wbc: "1e999", plt: "250" });
    expect(out.hb).toBeUndefined();
    expect(out.wbc).toBeUndefined();
    expect(out.plt).toEqual({ value: 250, flag: "normal" });
  });

  it("treats a whitespace-only entry as blank rather than zero", () => {
    // Number("  ") is 0, so this used to store a result of 0 — which for haemoglobin would be
    // flagged `low` and read as a catastrophic value the patient never had.
    const out = computeResults(fbcTemplate, { hb: "   " });
    expect(out.hb).toBeUndefined();
  });

  it("still stores an ordinary value with its flag", () => {
    expect(computeResults(fbcTemplate, { hb: "10.2" }).hb).toEqual({ value: 10.2, flag: "low" });
  });

  it("everything it does store survives a JSON round trip", () => {
    const out = computeResults(fbcTemplate, { hb: "10.2", wbc: "12.1", plt: "250" });
    expect(JSON.parse(JSON.stringify(out))).toEqual(out);
  });
});
