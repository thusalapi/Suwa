# Build Progress — Suwa

> **Read this first when starting a session.** It is the living record of what exists and
> what's next, so work continues cleanly across sessions. Keep it updated as you build —
> tick items off, move "Next up" items into "Done", and note any decisions/gotchas.

**Last updated:** 2026-06-21
**Current stage:** Stage 0 — Foundation (in progress)
**Build status:** ✅ `npm run build` + `npm run typecheck` pass

## How to run

```bash
npm install        # once
npm run dev        # http://localhost:3000  (redirects / → /login)
npm run build      # production build (standalone output for the clinic PC)
npm run typecheck  # tsc --noEmit
```

There is **no database yet**, so login is a non-functional placeholder UI.

## Reference (read alongside this file)

- Conventions: `.claude/skills/suwa-build`, `suwa-frontend`, `suwa-backend`
- Docs: `docs/architecture.md`, `docs/data-model.md`, `docs/branding.md`,
  `docs/report-engine.md`, `docs/roadmap.md`, `docs/requirements.md`

## Done

### Project scaffold
- [x] Next.js 16 (App Router, Turbopack) + TypeScript (strict)
- [x] `output: "standalone"` for self-hosting on the clinic PC (no Vercel)
- [x] Tailwind v4 (`@tailwindcss/postcss`), `globals.css` with `@theme inline`
- [x] Path alias `@/* → src/*`

### Design system (token-driven, themeable) — `src/lib/design/`
- [x] `tokens.primitive.ts` (raw palette + radius) → `tokens.semantic.ts` (roles) →
      `theme.ts` (`defaultTheme`, `buildTheme(override)`, `themeToCssVars`).
- [x] `globals.css` `@theme inline` maps Tailwind `--color-*` → `--ds-*`; theme injected at
      the root in `layout.tsx`. Components use semantic utilities (`bg-primary`,
      `text-ink`…) only — no raw hex. Per-tenant white-label theming ready (SaaS).
- [x] Structured for extraction to a shared `packages/ui` later. See `docs/design-system.md`.

### Centralized branding & i18n
- [x] `src/lib/branding/brand.ts` — product identity (name "Suwa", tagline, logo, localized
      name). Colours now live in the design-token layer (above).
- [x] `src/lib/i18n/` — `t()` with fallback to `en`, `{param}` interpolation,
      `formatMoney` (integer minor units → LKR) and `formatDate`. Locales: `en`, `si`,
      `ta` (all keys mirrored).

### Atomic components (`src/components/`)
- [x] atoms: `Button`, `Input`, `Label`, `Field`, `Badge`, `Spinner`, `Wordmark`
- [x] templates: `AuthShell`
- [x] App: root `layout.tsx`, `/` → redirect to `/login`, `(auth)/login` placeholder page

### Database layer (`src/lib/db/` + `liquibase/`)
- [x] Drizzle schema (`schema.ts`) — all 10 tables mirroring `docs/data-model.md` with the
      decisions: `users.password_hash`/`must_reset`, `patients` `unique(clinic_id, phone)` +
      optional `nic`, integer money, `clinic_id` everywhere, jsonb for templates/reports.
- [x] Drizzle client (`client.ts`, server-only, postgres.js) + barrel.
- [x] **Liquibase** changelog (`liquibase/changelog/` master + `001-initial-schema.sql`) —
      the migration source of truth, matching the Drizzle schema. `db:migrate`/`db:status`/
      `db:rollback` npm scripts; `liquibase.properties.example` (real one gitignored).
- [x] `drizzle.config.ts` for Studio/introspection only (NOT migrations).
- [ ] **Not yet run** — needs a local PostgreSQL on the clinic PC. See `liquibase/README.md`
      for one-time setup, then `npm run db:migrate`.

## Design system (claude.ai/design)

- [x] claude.ai login authorized for design-system access
- [x] Project created: **Suwa Design System** — `0eb0f77b-864f-4cd2-b299-1122bf0b9842`
      (https://claude.ai/design/p/0eb0f77b-864f-4cd2-b299-1122bf0b9842)
- [x] **First sync complete** — all 8 components uploaded with authored previews (graded
      good), real `.d.ts` contracts, `.prompt.md`, conventions header. Render check 8/8.
- Synced via `package` shape, synth-entry (`src/design-system.ts` barrel). Config + setup
  notes in `.design-sync/` (`config.json`, `conventions.md`, `previews/`, `NOTES.md`).
- **Re-sync when components grow**: re-run `/design-sync`; authored previews + grades carry
  forward. See `.design-sync/NOTES.md` (re-sync risks).

## Next up (ordered — finish Stage 0)

1. **Self-hosted auth** (`src/lib/auth/`)  ← next
   - argon2/bcrypt password hashing; signed HTTP-only session cookie; middleware to gate
     `(dashboard)`; server-side role guard helper (owner/staff/doctor).
   - Wire the login page to a Server Action (verify hash → set session).
   - `scripts/` one-time **seed-owner** script (no public sign-up).
2. **Audit log helper** (`src/lib/audit/`) — `recordAudit(tx, …)` used in-transaction.
3. **Clinic settings** — name, logo, currency, tax rate (reads/writes `clinics`).
4. **Backups** (`src/lib/backup/` + `scripts/`) — nightly `pg_dump` → encrypt → Google
   Drive; tested restore script; Windows Task Scheduler note.

Then Stage 1 (Patient registry — search/dedupe by phone), per `docs/roadmap.md`.

## Decisions & gotchas

- **Money** is integer minor units everywhere (LKR cents). Use `formatMoney`.
- **Patient lookup key = phone** (`unique(clinic_id, phone)`), NIC optional.
- `en.ts` is the canonical key set (no `as const` — keep values widened to `string` so
  `si`/`ta` typecheck). Add new keys to `en` first, then `si`, `ta`.
- Brand palette has a single origin in `brand.ts`; don't put raw hex in components — use
  `bg-primary` / `text-ink` etc.
- No shadcn, no Clerk, no Vercel. Build from atoms up; mutations re-check role server-side.
