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

Single source of truth: `src/lib/branding/brand.ts`

```ts
export const brand = {
  name: "Suwa",
  tagline: "Health, managed.",
  // script variants (optional, for localized headers)
  nameLocalized: { en: "Suwa", si: "සුව", ta: "ஆரோக்கியம்" },
  logo: { light: "/brand/suwa-logo.svg", dark: "/brand/suwa-logo-dark.svg" },
  colors: {                 // also mirrored into the Tailwind theme tokens
    primary: "#0E9F8E",     // teal/green — health
    primaryDark: "#0B7D70",
    accent: "#10B981",
    ink: "#0F172A",
  },
} as const;
```

Rules:
- Components reference `brand.*` — never a literal `"Suwa"`, hex code, or logo path.
- Tailwind theme colours are derived from `brand.colors` (defined once in the Tailwind
  config / CSS variables), so the palette has a single origin too.
- Changing the product name/logo/palette = editing `brand.ts` (+ swapping the asset).

## Centralized translations (i18n)

Locales at launch: **English (`en`)**, **Sinhala (`si`)**, **Tamil (`ta`)** — the three
languages a Sri Lankan clinic serves. English is the fallback.

Layout: `src/lib/i18n/`
```
src/lib/i18n/
├── index.ts            # t(), locale resolution, fallback chain
├── locales/
│   ├── en.ts           # source-of-truth keys
│   ├── si.ts
│   └── ta.ts
└── types.ts            # Locale union, TranslationKey type
```

Rules:
- **No hard-coded user-facing strings in components.** Every label, button, toast,
  validation message, table header, empty state, and PDF caption is a key resolved via
  `t("patients.search.placeholder")`.
- `en.ts` is the canonical key set; `si.ts`/`ta.ts` mirror its shape. A missing key
  falls back to `en` (and should fail typecheck / be linted, not crash).
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
- Adding a language later = one new `locales/*.ts` file.

## Checklist for any generated UI

- [ ] No literal brand name / hex / logo path — use `brand.*`.
- [ ] No literal user-facing string — use `t("namespace.key")`.
- [ ] New strings added to `en.ts` first, then `si.ts` and `ta.ts`.
- [ ] Money/date/number rendered via locale-aware formatters.
- [ ] Document (PDF) chrome uses **clinic identity** from the DB, product brand from
      `brand.*`.
