import { describe, expect, it } from "vitest";
import { formatPatientValue, titleCase, unitParts } from "@/lib/report-engine/display";

describe("unitParts", () => {
  it("raises squared/cubed length units", () => {
    expect(unitParts("ml/min/1.73 m2")).toEqual([{ text: "ml/min/1.73 m" }, { text: "2", sup: true }]);
    expect(unitParts("mm3")).toEqual([{ text: "mm" }, { text: "3", sup: true }]);
    expect(unitParts("/µm3")).toEqual([{ text: "/µm" }, { text: "3", sup: true }]);
  });

  it("raises ^n powers, including negative ones, and drops the caret", () => {
    expect(unitParts("x10^3/uL")).toEqual([{ text: "x10" }, { text: "3", sup: true }, { text: "/uL" }]);
    expect(unitParts("x10^9/L")).toEqual([{ text: "x10" }, { text: "9", sup: true }, { text: "/L" }]);
    expect(unitParts("mol.L^-1")).toEqual([{ text: "mol.L" }, { text: "-1", sup: true }]);
  });

  it("leaves ordinary units alone", () => {
    for (const u of ["mg/dl", "/Cu mm", "M/Cu mm", "mmol/l", "Pg", "fl", "g/dl", "%", "mg/g"]) {
      expect(unitParts(u)).toEqual([{ text: u }]);
    }
  });
});

describe("patient values", () => {
  it("title-cases sex, and only sex", () => {
    expect(formatPatientValue("gender", "male")).toBe("Male");
    expect(formatPatientValue("gender", "FEMALE".toLowerCase())).toBe("Female");
    expect(formatPatientValue("name", "w.shanthi")).toBe("w.shanthi");
    expect(formatPatientValue("age", 67)).toBe("67");
    expect(titleCase("other")).toBe("Other");
  });
});
