/** Whole years between a date of birth and today, or null when unknown/invalid. */
export function ageFromDob(dob: string | null | undefined, now: Date = new Date()): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 ? age : null;
}

/**
 * An estimated date of birth (YYYY-MM-DD) for a patient whose age is known but not their birth
 * date: today minus `age` years, so `ageFromDob` gives back `age` today and keeps counting up.
 */
export function estimatedDobFromAge(age: number, now: Date = new Date()): string {
  const y = now.getFullYear() - age;
  const m = String(now.getMonth() + 1).padStart(2, "0");
  // 29 Feb in a non-leap year → 28 Feb.
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  const d = String(Math.min(now.getDate(), lastDay)).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
