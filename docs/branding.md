# Branding & Localization

The product is branded **Suwa** (Sinhala සුව — "health / wellness"). Tagline:
**"Health, managed."**

Everything brand- and language-facing is **centralized** so it can be changed in one
place. No brand name, tagline, colour, or user-facing string is ever hard-coded inside a
component.

## Two layers of identity (don't conflate them)

1. **Product brand — "Suwa".** The software product itself. Fixed, lives in the branding
   config. Shown on the login screen, app shell, "powered by", etc.
2. **Clinic identity.** The *customer* clinic's name, logo, colours, address — comes from
   the `clinics` DB row and appears on invoices and reports. This is data, not config.

The branding config holds **product** defaults and the theme tokens; clinic identity is
read from the database at runtime and merged in for documents.

## Centralized branding

Product identity lives in `src/lib/branding/brand.ts` (name, tagline, logo, localized
name). **Colours/theme live in the design-token layer** (`src/lib/design`, see
`design-system.md`) so the palette is shared and themeable per tenant.

```ts
export const brand = {
  name: "Suwa",
  tagline: "Health, managed.",
  // script variants (optional, for localized headers) — English-only at launch
  nameLocalized: { en: "Suwa" },
  logo: { light: "/brand/suwa-logo.svg", dark: "/brand/suwa-logo-dark.svg" },
} as const;
```

Rules:
- Components reference `brand.*` for name/logo — never a literal `"Suwa"` or logo path.
- Colours come from **semantic Tailwind tokens** (`bg-primary`, `text-ink`…) backed by the
  design-token layer — never a raw hex in a component. The palette has a single origin in
  `lib/design/tokens.*`; per-tenant theming overrides roles (see `design-system.md`).
- Changing the product name/logo = editing `brand.ts` (+ swapping the asset). Changing the
  palette = editing the token files.

## Centralized translations (i18n)

Locale at launch: **English (`en`)** only. We keep the **multi-locale file pattern** in
place — one dictionary file per language, a `Locale` union, `t()` with a fallback chain —
so adding Sinhala (`si`) / Tamil (`ta`) later is a drop-in (new `locales/*.ts` file +
extend the union), **not** a refactor. Do not hard-code strings just because there is one
language today.

Layout: `src/lib/i18n/`
```
src/lib/i18n/
├── index.ts            # t(), locale resolution, fallback chain
├── locales/
│   └── en.ts           # source-of-truth keys (only locale at launch)
└── types.ts            # Locale union, DEFAULT_LOCALE
```

Rules:
- **No hard-coded user-facing strings in components.** Every label, button, toast,
  validation message, table header, empty state, and PDF caption is a key resolved via
  `t("patients.search.placeholder")`.
- `en.ts` is the canonical key set. Any locale added later lives in its own
  `locales/*.ts`, mirrors this shape, and falls back to `en` for missing keys.
- Keys are namespaced by feature (`patients.*`, `billing.*`, `reports.*`, `auth.*`,
  `common.*`).
- Interpolation uses named params: `t("billing.total", { amount })`.
- Numbers, currency (LKR), and dates go through locale-aware formatters, not string
  concatenation.
- The brand name comes from `brand.nameLocalized[locale]` (or `brand.name`), **not** from
  the translation dictionaries — branding and copy stay separate.

## Why centralized

- The user (clinic owner / you) can rebrand or re-translate without touching component
  code — edit config + dictionaries, regenerate nothing.
- Future, more optimized code generation can reshape components freely as long as it keeps
  reading from `brand.*` and `t(...)`.
- Adding a language later = one new `locales/*.ts` file + extend the `Locale` union — no
  component changes, because nothing hard-codes copy.

## Checklist for any generated UI

- [ ] No literal brand name / hex / logo path — use `brand.*`.
- [ ] No literal user-facing string — use `t("namespace.key")`.
- [ ] New strings added to `en.ts` (the only locale at launch).
- [ ] Money/date/number rendered via locale-aware formatters.
- [ ] Document (PDF) chrome uses **clinic identity** from the DB, product brand from
      `brand.*`.
