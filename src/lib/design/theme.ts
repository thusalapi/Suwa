import type { CSSProperties } from "react";
import { radius } from "./tokens.primitive";
import { semanticLight, type SemanticColors } from "./tokens.semantic";

/**
 * A Theme is the resolved set of semantic roles for a render. At MVP there is one
 * (defaultTheme). For SaaS multi-tenant white-labelling, build a per-tenant theme from the
 * clinic's stored brand overrides with `buildTheme(...)` and inject its CSS vars at the
 * document root — no component changes needed.
 */
export interface Theme {
  colors: SemanticColors;
  radius: typeof radius;
}

export const defaultTheme: Theme = {
  colors: semanticLight,
  radius,
};

/** Per-tenant overrides — e.g. a clinic's own primary colour. Roles only, never raw hex. */
export type ThemeOverride = {
  colors?: Partial<SemanticColors>;
};

export function buildTheme(override?: ThemeOverride): Theme {
  return {
    colors: { ...semanticLight, ...(override?.colors ?? {}) },
    radius,
  };
}

const cssVarName: Record<keyof SemanticColors, string> = {
  primary: "--ds-primary",
  primaryDark: "--ds-primary-dark",
  primaryFg: "--ds-primary-fg",
  accent: "--ds-accent",
  ink: "--ds-ink",
  muted: "--ds-muted",
  surface: "--ds-surface",
  surfaceRaised: "--ds-surface-raised",
  border: "--ds-border",
  danger: "--ds-danger",
  dangerFg: "--ds-danger-fg",
  success: "--ds-success",
  warning: "--ds-warning",
};

/**
 * Resolve a theme to the `--ds-*` CSS variables consumed by Tailwind's theme tokens
 * (mapped in globals.css via `@theme inline`). Inject once at the document root.
 */
export function themeToCssVars(theme: Theme = defaultTheme): CSSProperties {
  const vars: Record<string, string> = {};
  for (const role of Object.keys(theme.colors) as (keyof SemanticColors)[]) {
    vars[cssVarName[role]] = theme.colors[role];
  }
  vars["--ds-radius-md"] = theme.radius.md;
  vars["--ds-radius-lg"] = theme.radius.lg;
  return vars as CSSProperties;
}
