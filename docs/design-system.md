# Design System

Suwa's UI is a **token-driven, themeable design system** built in code (the source of
truth) and mirrored to a **Claude Design** project as a visual catalog. It is structured
so it can be extracted into a shared package when Suwa scales to multi-tenant SaaS.

## Layers (one direction of dependency)

```
tokens.primitive  →  tokens.semantic  →  theme  →  Tailwind tokens  →  components
   (raw values)        (roles)          (resolved   (@theme inline)     (atoms→…)
                                         per tenant)
```

1. **Primitive tokens** — `src/lib/design/tokens.primitive.ts`
   Raw, context-free values: the full colour palette (teal/emerald/slate/red/amber),
   radius scale. **Never referenced by components.**

2. **Semantic tokens** — `src/lib/design/tokens.semantic.ts`
   Roles that map onto primitives: `primary`, `primaryDark`, `primaryFg`, `accent`,
   `ink`, `muted`, `surface`, `surfaceRaised`, `border`, `danger`, `dangerFg`, `success`,
   `warning`. **Components consume only these.**

3. **Theme** — `src/lib/design/theme.ts`
   `defaultTheme` plus `buildTheme(override)` for per-tenant white-labelling.
   `themeToCssVars(theme)` resolves roles to `--ds-*` CSS variables.

4. **Tailwind tokens** — `src/app/globals.css`
   `@theme inline` maps `--color-*` → `var(--ds-*)`, so utilities like `bg-primary`,
   `text-ink`, `border-border` exist and resolve from the injected theme.

5. **Components** — `src/components/{atoms,molecules,organisms,templates}`
   Use Tailwind semantic utilities only. No raw hex, no primitive imports.

The theme's `--ds-*` variables are injected once at the document root in
`src/app/layout.tsx`. Changing the palette = editing the token files; theming a tenant =
injecting a different resolved theme — **no component edits either way.**

## Why this scales to SaaS

- **Multi-tenant white-labelling for free.** Each clinic can have its own `primary` (and
  any role) via a stored `ThemeOverride`; at request time resolve
  `buildTheme(clinic.brandOverride)` and inject its vars. This is the same product-brand
  vs. clinic-identity split described in `branding.md`.
- **Extractable.** The `lib/design` + `components/*` + `lib/i18n` slice has no app-specific
  dependencies, so it can move to a workspace package (e.g. `packages/ui`) in a Turborepo
  monorepo when the app splits into multiple surfaces (clinic app, admin, marketing).
- **Type-safe & versioned.** Tokens and component props are typed and live in git — every
  change is reviewable, testable, and diffable.

## Claude Design sync (visual catalog)

- The code is the source of truth; the **Suwa Design System** project on claude.ai/design
  is a synced visual catalog (preview cards per component, grouped Atoms / Forms / Screens).
- Sync is **code → Claude Design**, incremental, one component at a time, via the
  `/design-sync` skill (user-invoked). Project id is recorded in `PROGRESS.md`.
- When new components are built (Stage 1+), sync them up too so the catalog stays current.

## Rules for any new component

- Consume **semantic** Tailwind utilities (`bg-primary`, `text-ink`…), never a primitive
  token or a raw hex.
- New role needed? Add it to `tokens.semantic.ts`, map it in `theme.ts` (`cssVarName`) and
  `globals.css` (`@theme inline`) — then use it. Don't shortcut with a literal colour.
- Build from atoms up; keep the design-system slice free of business/data dependencies so
  it stays extractable.
- Add user-facing copy via `t()` (see `branding.md`), not literals.

## Future extensions (when needed)

- Typography & spacing scales as tokens (currently Tailwind defaults).
- Dark theme (add a `semanticDark` and switch the injected theme).
- Density modes; motion tokens.
