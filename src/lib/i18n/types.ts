// English-only at launch. The pattern stays multi-locale-ready: add a new `locales/*.ts`
// file and extend this list to introduce another language later (see docs/branding.md).
export const LOCALES = ["en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}
