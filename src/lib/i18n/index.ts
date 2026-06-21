import { en } from "./locales/en";
import { si } from "./locales/si";
import { ta } from "./locales/ta";
import { DEFAULT_LOCALE, type Locale } from "./types";

const dictionaries = { en, si, ta } as const;

type Params = Record<string, string | number>;

function resolve(dict: unknown, path: string): string | undefined {
  const value = path
    .split(".")
    .reduce<unknown>((acc, key) => (acc != null ? (acc as Record<string, unknown>)[key] : undefined), dict);
  return typeof value === "string" ? value : undefined;
}

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in params ? String(params[key]) : `{${key}}`,
  );
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

const localeTag: Record<Locale, string> = { en: "en-LK", si: "si-LK", ta: "ta-LK" };

/** Format integer minor units (e.g. cents) as currency. Money is always integer minor units. */
export function formatMoney(minorUnits: number, locale: Locale = DEFAULT_LOCALE, currency = "LKR"): string {
  return new Intl.NumberFormat(localeTag[locale], { style: "currency", currency }).format(minorUnits / 100);
}

export function formatDate(date: Date | string, locale: Locale = DEFAULT_LOCALE): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(localeTag[locale], { dateStyle: "medium" }).format(d);
}

export { DEFAULT_LOCALE, type Locale } from "./types";
