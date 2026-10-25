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

// `^3`, `^-1`, `^9`, an ion charge `^+` / `^-` / `^2+` …  or a length unit squared/cubed:
// `m2`, `mm3`, `cm2`, `dm3`, `µm3`, `um3`.
const POWER = /\^(-?\d+[+-]?|[+-])|(?<![A-Za-zµ])(mm|cm|dm|µm|um|m)([23])(?![\w])/g;
// Test names only use the explicit caret form ("Serum Na^+" → Na⁺), so ordinary names never change.
const CARET = /\^(-?\d+[+-]?|[+-])/g;

/** Split a unit into plain and superscript parts: "1.73 m2" → ["1.73 m", sup "2"]. */
export function unitParts(unit: string): UnitPart[] {
  return splitSup(unit, POWER);
}

/** Split a test name on explicit carets only: "Serum Cl^-" → ["Serum Cl", sup "-"]. */
export function nameParts(name: string): UnitPart[] {
  return splitSup(name, CARET);
}

/** Plain-text form of a name with carets (for labels): "Serum Na^+" → "Serum Na+". */
export function plainName(name: string): string {
  return name.replace(CARET, "$1");
}

function splitSup(unit: string, re: RegExp): UnitPart[] {
  const parts: UnitPart[] = [];
  let last = 0;
  for (const m of unit.matchAll(re)) {
    const start = m.index ?? 0;
    const before = unit.slice(last, start) + (m[2] ?? "");
    if (before) parts.push({ text: before });
    parts.push({ text: m[1] ?? m[3], sup: true });
    last = start + m[0].length;
  }
  if (last < unit.length) parts.push({ text: unit.slice(last) });
  return parts;
}

/** A footnote split for a hanging-indent layout: "Note:" label + numbered points. */
export interface NoteParts {
  label?: string;
  items: { num?: string; text: string }[];
}

/**
 * Parse a note like "Note:  1. First…\n   2. Second…" into its label and points, so it can be laid
 * out with the numbers aligned and wrapped lines indented under their text. Unnumbered lines
 * continue the previous point.
 */
export function noteParts(text: string): NoteParts {
  const lines = text.split(/\r?\n/);
  let label: string | undefined;
  const m = lines[0]?.match(/^\s*([^:\d][^:]{0,20}):\s*(.*)$/);
  if (m) {
    label = `${m[1].trim()}:`;
    lines[0] = m[2];
  }
  const items: NoteParts["items"] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const n = line.match(/^(\d+[.)])\s*(.*)$/);
    if (n) items.push({ num: n[1], text: n[2] });
    else if (items.length) items[items.length - 1].text += ` ${line}`;
    else items.push({ text: line });
  }
  return { label, items };
}

/** Title-case a stored patient value for display — used for sex ("male" → "Male"). */
export function titleCase(value: string): string {
  return value.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

/** A stored datetime-local value ("2026-10-24T11:16") as the lab prints it: "24/10/2026 11:16". */
export function formatStoredDateTime(value: string): string {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return value;
  return `${m[3]}/${m[2]}/${m[1]}${m[4] ? ` ${m[4]}:${m[5]}` : ""}`;
}

/** A patient_info value as shown on a report: sex title-cased, date & time in the lab's style. */
export function formatPatientValue(field: string, value: string | number): string {
  if (field === "gender") return titleCase(String(value));
  if (field === "datetime") return formatStoredDateTime(String(value));
  return String(value);
}
