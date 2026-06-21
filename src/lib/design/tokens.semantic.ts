import { palette } from "./tokens.primitive";

/**
 * SEMANTIC tokens — roles ("where it's used"). Components consume ONLY these (via Tailwind
 * utilities like `bg-primary`, `text-ink`). A tenant theme overrides roles here, not raw
 * palette values, so re-branding one clinic never touches component code. See theme.ts.
 */
export const semanticLight = {
  primary: palette.teal[600],
  primaryDark: palette.teal[700],
  primaryFg: palette.white,
  accent: palette.emerald[500],

  ink: palette.slate[900],
  muted: palette.slate[500],

  surface: palette.slate[50], // page background
  surfaceRaised: palette.white, // cards/panels
  border: palette.slate[200],

  danger: palette.red[600],
  dangerFg: palette.white,
  success: palette.emerald[600],
  warning: palette.amber[500], // e.g. abnormal-result flags
} as const;

export type SemanticColors = typeof semanticLight;
export type SemanticColorRole = keyof SemanticColors;
