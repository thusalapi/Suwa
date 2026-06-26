import { describe, it, expect } from "vitest";
import { computeFlag, isAbnormal, isCritical, type RefRange } from "@/lib/report-engine/flag";

const range: RefRange = { ref_low: 13, ref_high: 17, critical_low: 7, critical_high: 22 };

describe("computeFlag", () => {
  it("flags a value inside the reference range as normal", () => {
    expect(computeFlag(15, range)).toBe("normal");
  });

  it("flags below ref_low as low and above ref_high as high", () => {
    expect(computeFlag(10, range)).toBe("low");
    expect(computeFlag(20, range)).toBe("high");
  });

  it("treats the reference bounds themselves as normal (strict < / >)", () => {
    expect(computeFlag(13, range)).toBe("normal");
    expect(computeFlag(17, range)).toBe("normal");
  });

  it("lets critical bounds take precedence over low/high", () => {
    expect(computeFlag(5, range)).toBe("critical_low"); // also < ref_low, but critical wins
    expect(computeFlag(25, range)).toBe("critical_high");
  });

  it("includes the critical bound itself (inclusive <= / >=)", () => {
    expect(computeFlag(7, range)).toBe("critical_low");
    expect(computeFlag(22, range)).toBe("critical_high");
  });

  it("returns normal when the range defines no bounds", () => {
    expect(computeFlag(999, {})).toBe("normal");
  });

  it("honours a one-sided range", () => {
    expect(computeFlag(3, { ref_low: 5 })).toBe("low");
    expect(computeFlag(9, { ref_low: 5 })).toBe("normal");
    expect(computeFlag(0, { critical_high: 10 })).toBe("normal");
  });
});

describe("isAbnormal / isCritical", () => {
  it("isAbnormal is true for everything except normal", () => {
    expect(isAbnormal("normal")).toBe(false);
    expect(isAbnormal("low")).toBe(true);
    expect(isAbnormal("critical_high")).toBe(true);
  });

  it("isCritical is true only for the critical flags", () => {
    expect(isCritical("critical_low")).toBe(true);
    expect(isCritical("critical_high")).toBe(true);
    expect(isCritical("high")).toBe(false);
    expect(isCritical("normal")).toBe(false);
  });
});
