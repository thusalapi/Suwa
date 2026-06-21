type ClassValue = string | number | false | null | undefined;

/** Minimal className joiner. Filters out falsey values. */
export function cn(...parts: ClassValue[]): string {
  return parts.filter(Boolean).join(" ");
}
