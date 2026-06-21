import type { CSSProperties } from "react";
import type { Locale } from "@/lib/i18n/types";

/**
 * Single source of truth for the PRODUCT brand ("Suwa").
 * Never hard-code the name, a colour, or a logo path in a component — read from here.
 * Clinic identity (the customer's name/logo on invoices/reports) is separate data,
 * read from the `clinics` DB row. See docs/branding.md.
 */
export const brand = {
  name: "Suwa",
  tagline: "Health, managed.",
  nameLocalized: { en: "Suwa", si: "සුව", ta: "ஆரோக்கியம்" } satisfies Record<Locale, string>,
  logo: {
    light: "/brand/suwa-logo.svg",
    dark: "/brand/suwa-logo-dark.svg",
  },
  colors: {
    primary: "#0E9F8E",
    primaryDark: "#0B7D70",
    accent: "#10B981",
    ink: "#0F172A",
    surface: "#F8FAFC",
    muted: "#64748B",
    border: "#E2E8F0",
    danger: "#DC2626",
  },
} as const;

/** Localized product name; falls back to the canonical name. */
export function brandName(locale?: Locale): string {
  return (locale && brand.nameLocalized[locale]) || brand.name;
}

/**
 * CSS custom properties injected once at the document root so Tailwind's theme tokens
 * (mapped in globals.css via `@theme inline`) resolve from this single origin.
 */
export const brandCssVars: CSSProperties = {
  "--brand-primary": brand.colors.primary,
  "--brand-primary-dark": brand.colors.primaryDark,
  "--brand-accent": brand.colors.accent,
  "--brand-ink": brand.colors.ink,
  "--brand-surface": brand.colors.surface,
  "--brand-muted": brand.colors.muted,
  "--brand-border": brand.colors.border,
  "--brand-danger": brand.colors.danger,
} as CSSProperties;
