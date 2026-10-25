/**
 * Display-only formatting shared by the report form, the on-screen view and the PDF. Templates and
 * stored data keep plain text (`ml/min/1.73 m2`, `x10^3/uL`, `male`); these helpers only change how
 * it is shown, so already-issued reports pick the formatting up too.
 */

/** A piece of a unit; `sup` pieces are rendered as a superscript (power). */
export interface UnitPart {
  text: string;
  sup?: boolean;
}

// `^3`, `^-1`, `^9` …  or a length unit squared/cubed: `m2`, `mm3`, `cm2`, `dm3`, `µm3`, `um3`.
const POWER = /\^(-?\d+)|(?<![A-Za-zµ])(mm|cm|dm|µm|um|m)([23])(?![\w])/g;

/** Split a unit into plain and superscript parts: "1.73 m2" → ["1.73 m", sup "2"]. */
export function unitParts(unit: string): UnitPart[] {
  const parts: UnitPart[] = [];
  let last = 0;
  for (const m of unit.matchAll(POWER)) {
    const start = m.index ?? 0;
    const before = unit.slice(last, start) + (m[2] ?? "");
    if (before) parts.push({ text: before });
    parts.push({ text: m[1] ?? m[3], sup: true });
    last = start + m[0].length;
  }
  if (last < unit.length) parts.push({ text: unit.slice(last) });
  return parts;
}

/** Title-case a stored patient value for display — used for sex ("male" → "Male"). */
export function titleCase(value: string): string {
  return value.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

/** A patient_info value as shown on a report (sex is title-cased; everything else as stored). */
export function formatPatientValue(field: string, value: string | number): string {
  return field === "gender" ? titleCase(String(value)) : String(value);
}
