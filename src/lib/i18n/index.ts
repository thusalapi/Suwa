import { appTimeZone, zonedParts } from "@/lib/time";
import { en } from "./locales/en";
import { DEFAULT_LOCALE, type Locale } from "./types";

// One dictionary per locale. English-only at launch; add a new entry (and a `locales/*.ts`
// file + a Locale in ./types) to introduce another language later.
const dictionaries = { en } as const;

type Params = Record<string, string | number>;

function resolve(dict: unknown, path: string): string | undefined {
  const value = path
    .split(".")
    .reduce<unknown>((acc, key) => (acc != null ? (acc as Record<string, unknown>)[key] : undefined), dict);
  return typeof value === "string" ? value : undefined;
}

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => (key in params ? String(params[key]) : `{${key}}`));
}

/** Returns a translator bound to a locale, with fallback to `en` then the raw key. */
export function getT(locale: Locale = DEFAULT_LOCALE) {
  return (key: string, params?: Params): string => {
    const value = resolve(dictionaries[locale], key) ?? resolve(dictionaries.en, key) ?? key;
    return interpolate(value, params);
  };
}

/** Default translator (server default locale). Swap per-request once locale lookup lands. */
export const t = getT();

// --- locale-aware formatters (use these, never inline toLocaleString) ---

const localeTag: Record<Locale, string> = { en: "en-LK" };

/** Format integer minor units (e.g. cents) as currency. Money is always integer minor units. */
export function formatMoney(minorUnits: number, locale: Locale = DEFAULT_LOCALE, currency = "LKR"): string {
  return new Intl.NumberFormat(localeTag[locale], { style: "currency", currency }).format(minorUnits / 100);
}

export function formatDate(date: Date | string, locale: Locale = DEFAULT_LOCALE): string {
  // A bare "YYYY-MM-DD" is a calendar day, not an instant: format it as that day.
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Intl.DateTimeFormat(localeTag[locale], { dateStyle: "medium", timeZone: "UTC" }).format(
      new Date(`${date}T00:00:00Z`),
    );
  }
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(localeTag[locale], { dateStyle: "medium", timeZone: appTimeZone() }).format(d);
}

/**
 * Date and time as the lab prints it — "24/10/2026 11:16" (day/month/year, 24-hour), on the
 * clinic's clock (APP_TIMEZONE), whatever zone the server itself runs in.
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const z = zonedParts(d);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(z.day)}/${p(z.month)}/${z.year} ${p(z.hour)}:${p(z.minute)}`;
}

/** "Now" on the clinic's clock as a datetime-local input value ("2026-10-25T13:16"). */
export function nowForDateTimeInput(now: Date = new Date()): string {
  const z = zonedParts(now);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${z.year}-${p(z.month)}-${p(z.day)}T${p(z.hour)}:${p(z.minute)}`;
}

export { DEFAULT_LOCALE, type Locale } from "./types";
