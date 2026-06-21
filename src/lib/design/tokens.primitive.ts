/**
 * PRIMITIVE tokens — the raw, context-free values ("what"). Never reference these
 * directly in components. Components use SEMANTIC tokens (tokens.semantic.ts), which map
 * roles onto these. This indirection is what makes per-tenant theming possible at SaaS
 * scale: a tenant overrides a role (e.g. `primary`), not a raw colour everywhere.
 */

export const palette = {
  white: "#FFFFFF",
  black: "#000000",

  // Brand teal — Suwa "health" hue (500/600 are the brand primaries)
  teal: {
    50: "#ECFDF8",
    100: "#CFFAEC",
    200: "#A0F2DA",
    300: "#66E4C4",
    400: "#2FCFAC",
    500: "#12B5A0",
    600: "#0E9F8E",
    700: "#0B7D70",
    800: "#0A6359",
    900: "#08504A",
  },

  emerald: {
    400: "#34D399",
    500: "#10B981",
    600: "#059669",
  },

  slate: {
    50: "#F8FAFC",
    100: "#F1F5F9",
    200: "#E2E8F0",
    300: "#CBD5E1",
    400: "#94A3B8",
    500: "#64748B",
    600: "#475569",
    700: "#334155",
    800: "#1E293B",
    900: "#0F172A",
  },

  red: {
    500: "#EF4444",
    600: "#DC2626",
  },

  amber: {
    500: "#F59E0B",
    600: "#D97706",
  },
} as const;

/** Radius scale. Typography/spacing use Tailwind defaults for now (extend here later). */
export const radius = {
  sm: "0.25rem",
  md: "0.375rem",
  lg: "0.75rem",
  full: "9999px",
} as const;
