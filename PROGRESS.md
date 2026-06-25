# Build Progress — Suwa

> **Read this first when starting a session.** It is the living record of what exists and
> what's next, so work continues cleanly across sessions. Keep it updated as you build —
> tick items off, move "Next up" items into "Done", and note any decisions/gotchas.

**Last updated:** 2026-06-25
**Current stage:** Stage 0 — Foundation (in progress; auth + clinic settings landed)
**Build status:** ✅ `npm run typecheck` passes. `npm run build` needs `DATABASE_URL` set
(the db client opens the connection at import) — that's a clinic-PC setup step.

## How to run

```bash
npm install        # once
npm run dev        # http://localhost:3000  (redirects / → /login)
npm run build      # production build (standalone output for the clinic PC)
npm run typecheck  # tsc --noEmit
```

Login is **fully wired** (Server Action → verify hash → session cookie). It needs a local
PostgreSQL with migrations applied and a seeded owner to actually sign in:

```bash
npm run db:migrate   # apply Liquibase changelog (needs local Postgres + .env)
npm run seed:owner -- --clinic "Suwa Medical Centre" \
  --name "Dr. Perera" --email owner@clinic.lk --password "a-strong-password"
```

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
      `formatMoney` (integer minor units → LKR) and `formatDate`. **English-only at launch
      (`en`)** on the multi-locale file pattern — add a `locales/*.ts` + extend the `Locale`
      union to introduce another language later.

### Atomic components (`src/components/`)
- [x] atoms: `Button`, `Input`, `Label`, `Field`, `Badge`, `Spinner`, `Wordmark`
- [x] molecules: `Topbar`, `LogoutButton`
- [x] templates: `AuthShell`
- [x] App: root `layout.tsx`, `/` → redirect to `/login`, `(auth)/login` (wired form),
      `(app)/layout.tsx` (gated shell) + `(app)/dashboard`

### Authentication (`src/lib/auth/` + middleware) ✅
- [x] Session: stateless HMAC-SHA256 signed token (Web Crypto, verifies in edge + node),
      HTTP-only `suwa_session` cookie, 8h expiry (`session.ts`).
- [x] Passwords: argon2id via `@node-rs/argon2` (`password.ts`, server-only).
- [x] Guards: `getSession` / `getCurrentUser` / `requireUser` / `requireRole` (`index.ts`).
- [x] Middleware gates everything except `/login` + static; redirects both directions.
- [x] Login Server Action (`(auth)/login/actions.ts`) — Zod-validated, constant-ish time
      on unknown email, generic errors, sets cookie + audits `auth.login`. Client form via
      `useActionState` (`LoginForm.tsx`).
- [x] Logout Server Action (`lib/auth/actions.ts`) — audits `auth.logout`, clears cookie.
- [x] Shared `loginSchema` (`lib/schema/auth.ts`).
- [x] One-time `scripts/seed-owner.ts` (`npm run seed:owner`) — creates clinic + owner,
      refuses if an owner exists. No public sign-up.

### Clinic settings (`src/lib/clinic/` + `(app)/settings`) ✅
- [x] `lib/clinic/index.ts` — `getClinic` (tenant-scoped read) + `updateClinicSettings`
      (change + audit row in one transaction; `clinic.update` audited).
- [x] Shared `clinicSettingsSchema` (`lib/schema/clinic.ts`) — name/address/phone/logoUrl,
      3-letter currency, tax entered as %; action converts % → basis points.
- [x] Owner-only page (`requireRole("owner")`), Server Action re-checks role server-side,
      `revalidatePath` refreshes the page + layout (Topbar clinic name).
- [x] `SettingsForm` (`useActionState`) with field/success messaging; Topbar now has a
      Dashboard + (owner) Settings nav.

### Audit log (`src/lib/audit/`) ✅
- [x] `recordAudit(entry, exec?)` — accepts `db` or a transaction handle so the change and
      its audit row commit together. `Tx`/`Executor` types in `lib/db/index.ts`.

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

1. **Run the DB locally** — install Postgres on the dev/clinic PC, `npm run db:migrate`,
   `npm run seed:owner`, then verify login end-to-end. (See `liquibase/README.md`.)
2. ~~Clinic settings~~ ✅ done (see above).
3. **Backups** (`src/lib/backup/` + `scripts/`) — nightly `pg_dump` → encrypt → Google
   Drive; tested restore script; Windows Task Scheduler note.
4. **First-login password reset** — `must_reset` flow for invited staff/doctor.
5. **Staff/doctor invites** — owner creates accounts from settings (no public sign-up).

Then Stage 1 (Patient registry — search/dedupe by phone), per `docs/roadmap.md`.

## Decisions & gotchas

- **Money** is integer minor units everywhere (LKR cents). Use `formatMoney`.
- **Patient lookup key = phone** (`unique(clinic_id, phone)`), NIC optional.
- `en.ts` is the canonical key set (no `as const` — values widened to `string`). **English
  only at launch**; the file-per-locale pattern is retained so `si`/`ta` can be added later
  without touching components. Add new keys to `en`.
- Brand palette has a single origin in `brand.ts`; don't put raw hex in components — use
  `bg-primary` / `text-ink` etc.
- No shadcn, no Clerk, no Vercel. Build from atoms up; mutations re-check role server-side.
