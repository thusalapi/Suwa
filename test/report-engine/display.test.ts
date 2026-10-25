import { describe, expect, it } from "vitest";
import { formatPatientValue, nameParts, noteParts, plainName, titleCase, unitParts } from "@/lib/report-engine/display";

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

describe("noteParts", () => {
  it("splits the label and numbered points, ignoring the source's space-indentation", () => {
    const text = "Note:  1. First point.\n          2. Second point\n             continues here.\n   3. Third.";
    expect(noteParts(text)).toEqual({
      label: "Note:",
      items: [
        { num: "1.", text: "First point." },
        { num: "2.", text: "Second point continues here." },
        { num: "3.", text: "Third." },
      ],
    });
  });

  it("handles plain text without a label or numbers", () => {
    expect(noteParts("Fasting required.")).toEqual({ label: undefined, items: [{ text: "Fasting required." }] });
  });
});

describe("nameParts (ion charges in test names)", () => {
  it("raises explicit caret charges and leaves other names alone", () => {
    expect(nameParts("Serum Na^+")).toEqual([{ text: "Serum Na" }, { text: "+", sup: true }]);
    expect(nameParts("Serum Cl^-")).toEqual([{ text: "Serum Cl" }, { text: "-", sup: true }]);
    expect(nameParts("Serum Ca^2+")).toEqual([{ text: "Serum Ca" }, { text: "2+", sup: true }]);
    expect(nameParts("Cholesterol/HDL Ratio")).toEqual([{ text: "Cholesterol/HDL Ratio" }]);
    expect(nameParts("Serum Urea m2")).toEqual([{ text: "Serum Urea m2" }]); // no length-unit magic in names
    expect(plainName("Serum K^+")).toBe("Serum K+");
  });
});
