/**
 * Reference-range flagging. A flag is computed once on data entry and STORED with the value;
 * the PDF/render path never recomputes it, so an issued report stays reproducible even if the
 * template's ranges change later (see docs/report-engine.md "Flagging logic").
 */
export const FLAGS = ["normal", "low", "high", "critical_low", "critical_high"] as const;
export type Flag = (typeof FLAGS)[number];

/** The range fields an analyte row can define. All optional — a row with none is always normal. */
export interface RefRange {
  ref_low?: number;
  ref_high?: number;
  critical_low?: number;
  critical_high?: number;
}

/**
 * Classify a numeric result against a reference range. Critical bounds take precedence over
 * the normal low/high bounds.
 */
export function computeFlag(value: number, range: RefRange): Flag {
  if (range.critical_low != null && value <= range.critical_low) return "critical_low";
  if (range.critical_high != null && value >= range.critical_high) return "critical_high";
  if (range.ref_low != null && value < range.ref_low) return "low";
  if (range.ref_high != null && value > range.ref_high) return "high";
  return "normal";
}

/** True for flags that should be visually emphasised as out-of-range. */
export function isAbnormal(flag: Flag): boolean {
  return flag !== "normal";
}

/** True for the critical flags (render bold + highlighted). */
export function isCritical(flag: Flag): boolean {
  return flag === "critical_low" || flag === "critical_high";
}
