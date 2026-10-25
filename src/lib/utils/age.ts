import { zonedParts } from "@/lib/time";

/** Parse "YYYY-MM-DD" (a calendar date, no time zone). */
function parseDay(s: string): { y: number; m: number; d: number } | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null;
}

/** Whole years between a date of birth and today on the clinic's clock, or null when unknown/invalid. */
export function ageFromDob(dob: string | null | undefined, now: Date = new Date()): number | null {
  if (!dob) return null;
  const b = parseDay(dob);
  if (!b) return null;
  const t = zonedParts(now);
  let age = t.year - b.y;
  if (t.month < b.m || (t.month === b.m && t.day < b.d)) age--;
  return age >= 0 ? age : null;
}

/**
 * An estimated date of birth (YYYY-MM-DD) for a patient whose age is known but not their birth
 * date: today (clinic clock) minus `age` years, so `ageFromDob` gives back `age` today and keeps
 * counting up.
 */
export function estimatedDobFromAge(age: number, now: Date = new Date()): string {
  const t = zonedParts(now);
  const y = t.year - age;
  // 29 Feb in a non-leap year → 28 Feb.
  const lastDay = new Date(Date.UTC(y, t.month, 0)).getUTCDate();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${y}-${p(t.month)}-${p(Math.min(t.day, lastDay))}`;
}
