# Suwa design system — how to build with it

Suwa is a clinic-management UI: a token-driven, themeable React design system. Components
are hand-built on Tailwind utilities backed by design tokens. Build *with* these
components; use the token utilities below for your own layout glue. Never hard-code a hex
colour or the brand name.

## Setup (no provider needed)

Import the design system's `styles.css` once at the app root. It carries the utility
classes **and** defines the default theme as `:root { --ds-* }` CSS variables, so every
component is fully styled without any provider or theme wrapper. Components are available
as real React exports (e.g. `Button`, `Field`).

**Theming (white-label):** to re-theme (e.g. per clinic), set the `--ds-*` variables on a
wrapping element — `--ds-primary`, `--ds-ink`, `--ds-surface`, `--ds-border`,
`--ds-danger`, etc. Components read these through their utilities, so overriding the
variables re-skins everything with no component changes.

## Styling idiom — token utilities (use these, not raw colours)

| Purpose | Classes |
|---|---|
| Page / card surfaces | `bg-surface` (page), `bg-surface-raised` or `bg-white` (cards), `border-border` |
| Text | `text-ink` (primary), `text-muted` (secondary), `text-primary` (brand), `text-danger` (errors) |
| Brand / primary actions | `bg-primary`, `bg-primary-dark` (hover), `text-white` (on primary), `text-primary-dark` |
| Danger / negative | `bg-danger`, `border-danger`, `text-danger` |

For spacing/layout use normal Tailwind utilities. For colour, stay inside the list above
or reference the `--ds-*` variables directly — there is no other palette.

## Components (compose these for controls)

- **Button** — `variant`: `primary` | `secondary` | `ghost` | `danger`; `size`: `sm` | `md`.
- **Input** — text field; `invalid` for error state. Pair with **Field**.
- **Field** — label + control + `hint`/`error`. Pass `label`, `htmlFor`, and the control as children.
- **Label** — standalone field label.
- **Badge** — status pill; `tone`: `neutral` | `success` | `danger`.
- **Spinner** — loading indicator; requires an accessible `label`.
- **Wordmark** — the **Suwa** product name; `locale`: `en` | `si` | `ta`. Use this instead of typing "Suwa".
- **AuthShell** — centered shell for sign-in screens; renders the wordmark + tagline around its children.

Read each component's `<Name>.d.ts` (props) and `<Name>.prompt.md` (usage) before
composing. `guidelines/` holds the branding and design-system docs.

## Idiomatic example

```tsx
<form className="grid gap-4 bg-surface-raised border border-border rounded-lg p-6">
  <Field label="Phone number" htmlFor="phone" hint="Used to find the patient">
    <Input id="phone" placeholder="+94 77 123 4567" />
  </Field>
  <Field label="NIC (optional)" htmlFor="nic">
    <Input id="nic" placeholder="200012345678" />
  </Field>
  <div className="flex items-center justify-between">
    <Badge tone="success">Verified</Badge>
    <Button>Save patient</Button>
  </div>
</form>
```
