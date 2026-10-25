import { describe, expect, it } from "vitest";
import { matchesTemplate } from "@/app/(app)/reports/new/TemplatePicker";

describe("template search", () => {
  it("matches words in any case, ignoring dots, dashes and brackets", () => {
    expect(matchesTemplate("Lipid Profile", "lipid")).toBe(true);
    expect(matchesTemplate("SGOT (AST)", "sgot")).toBe(true);
    expect(matchesTemplate("SGOT (AST)", "ast")).toBe(true);
    expect(matchesTemplate("Glyco - Haemoglobin", "glyco haem")).toBe(true);
    expect(matchesTemplate("Blood Grouping & Rh", "rh blood")).toBe(true);
  });

  it("matches initials", () => {
    expect(matchesTemplate("Fasting Blood Sugar", "fbs")).toBe(true);
    expect(matchesTemplate("Postprandial Blood Sugar", "pbs")).toBe(true);
    expect(matchesTemplate("Full Blood Count", "FBC")).toBe(true);
    expect(matchesTemplate("Urine Full Report", "ufr")).toBe(true);
  });

  it("matches the lab's short names (aliases)", () => {
    expect(matchesTemplate("Postprandial Blood Sugar", "ppbs", ["PPBS"])).toBe(true);
    expect(matchesTemplate("Liver Profile Test", "lft", ["LFT", "liver"])).toBe(true);
    expect(matchesTemplate("Glyco - Haemoglobin", "hba1c", ["HbA1c"])).toBe(true);
    expect(matchesTemplate("Glyco - Haemoglobin", "ppbs", ["HbA1c"])).toBe(false);
  });

  it("shows everything for an empty query and rejects non-matches", () => {
    expect(matchesTemplate("ESR", "  ")).toBe(true);
    expect(matchesTemplate("Lipid Profile", "renal")).toBe(false);
    expect(matchesTemplate("Fasting Blood Sugar", "fbc")).toBe(false);
  });
});
