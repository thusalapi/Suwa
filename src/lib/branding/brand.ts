import type { Locale } from "@/lib/i18n/types";

/**
 * Single source of truth for the PRODUCT brand ("Suwa") — name, tagline, logo.
 * Colours/theme live in the design-token layer (`lib/design`), so the palette is shared
 * and themeable per tenant. Clinic identity (the customer's name/logo on invoices/reports)
 * is separate runtime data from the `clinics` DB row. See docs/branding.md + design-system.md.
 */
export const brand = {
  name: "Suwa",
  tagline: "Health, managed.",
  nameLocalized: { en: "Suwa", si: "සුව", ta: "ஆரோக்கியம்" } satisfies Record<Locale, string>,
  logo: {
    light: "/brand/suwa-logo.svg",
    dark: "/brand/suwa-logo-dark.svg",
  },
} as const;

/** Localized product name; falls back to the canonical name. */
export function brandName(locale?: Locale): string {
  return (locale && brand.nameLocalized[locale]) || brand.name;
}
