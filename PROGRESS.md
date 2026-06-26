# Build Progress — Suwa

> **Read this first when starting a session.** It is the living record of what exists and
> what's next, so work continues cleanly across sessions. Keep it updated as you build —
> tick items off, move "Next up" items into "Done", and note any decisions/gotchas.

**Last updated:** 2026-06-27
**Current stage:** Stage 5 — Polish + real-data trial, **in progress**. Code-polish done
(payment overpayment guard; audit coverage verified complete across every mutation). Still
to do, blocked on a live DB + pg tools: real-data trial in the browser and the **backup +
restore drill** (the one un-exercised non-negotiable). Stage 4 (dashboard + revenue) ✅.
DB runs in Docker (suwa-db).
**Build status:** ✅ `npm run typecheck` and `npm run build` both pass (build connects to the
Docker DB via `.env`). RevenueDocument PDF render verified via tsx (valid %PDF buffer).

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

### Stage 5 — Polish + real-data trial (in progress)
- [x] **Payment edge cases** — `recordPayment` now rejects a payment larger than the
      outstanding balance (`exceeds_balance`) and a payment against an already-settled bill
      (`already_settled`); `BillError` carries a `code` so the action maps each to a specific
      i18n message (`bills.payExceedsBalance` / `bills.paySettled`). `PaymentForm` also caps
      the amount input at the current balance (`maxRupees`) as a client hint.
- [x] **Audit coverage verified** — every mutation writes its audit row in the same tx:
      service.create/update (+ setActive), bill.create, payment.create, patient.create/update,
      report.create/verify, template.create/update (+ setActive), user.create,
      auth.password_reset, clinic.update, auth.login/logout. No gaps.
- [ ] **Real-data trial** — run real patients / bills / reports in the browser; fix friction.
- [ ] **Backup + restore drill** — exercise `docs/backups.md` end-to-end (needs Postgres +
      `pg_dump`/`rclone` on the clinic PC). The last Stage-5 non-negotiable still un-run.

### Stage 4 — Dashboard & reporting ✅
- [x] **Dashboard stats** — `lib/dashboard/` (`getDashboardStats`): revenue collected today
      (payments joined to bills), bills + total billed today, pending (unverified) reports,
      and current outstanding balance + count. Day bounds use the server's local clock
      (the clinic PC). All clinic-scoped; money stays integer minor units.
- [x] **Owner dashboard UI** — `(app)/dashboard` rewritten: four `StatCard`s (new molecule)
      + quick-action links (new patient/bill/report, and owner → revenue report).
- [x] **Revenue analytics** — `lib/analytics/` (`resolveRange` defaults to month-to-date,
      validates/normalizes `from`/`to`; `getRevenueReport`): billed + collected + bill count
      over a range, **by-service breakdown** (grouped on snapshotted `bill_items.description`),
      and the current **outstanding-payments** list (balance > 0, newest-balance first).
- [x] **Revenue report page** (`(app)/revenue`, owner-only) — date-range GET form (no-JS),
      summary stat cards, by-service table, outstanding table (links to bills), export buttons.
- [x] **Exports** — `(app)/revenue/csv` (UTF-8 BOM, money as decimal major units) and
      `(app)/revenue/pdf` (`components/pdf/RevenueDocument`, branded, reuses the PDF pipeline).
      Both owner-only Route Handlers honoring `?from=&to=`. **Revenue** nav link (owner-only).

### Stage 3 — Billing ✅
- [x] **Service/price catalog** — `lib/catalog/` (`listServices` w/ `activeOnly`, `getService`,
      `createService`/`updateService`, `setServiceActive` soft toggle). Shared `serviceSchema`:
      price entered in rupees → integer minor units. Owner-only `(app)/services`. `service.*` audit.
- [x] **Bills** — `lib/bills/` (`createBill` snapshots line description+unitPrice, computes
      subtotal/discount/tax-from-clinic/total, **gap-free `bill_number`** via per-clinic advisory
      lock; `recordPayment` updates amountPaid/balance, flips to `paid` at zero; `getBill`,
      `listBills`). `bill.create`/`payment.create` audit in one tx. Shared `billSchema`/`paymentSchema`.
- [x] **UI** — `(app)/bills`: list, `new` (dynamic line items w/ live totals from `BillForm`,
      catalog or free-text), `[id]` view (items/totals/payments + `PaymentForm`). Wired into
      patient detail (bills list + New bill); **Bills** nav link (all roles).
- [x] **Invoice PDF** — `components/pdf/BillDocument` + Route Handler `(app)/bills/[id]/pdf`
      (RECEIPT when paid, else INVOICE; reuses the report PDF pipeline). Render verified via tsx.

### Stage 2 — Report engine (`src/lib/report-engine/` + templates + reports + PDF) ✅
- [x] `template.ts` — Zod template schema (block types: `static`, `patient_info`, `field`,
      `results_table`, `textarea`, `signature`) + inferred TS types; `superRefine` enforces
      snake_case keys, unique field/row keys, reserved namespaces, select-needs-options,
      `ref_low ≤ ref_high`. `parseTemplate`, `resultRows` helpers.
- [x] `flag.ts` — `computeFlag(value, range)` (critical bounds take precedence) + `isAbnormal`
      / `isCritical`. Flags are computed on entry and **stored** (never recomputed at render).
- [x] `report-data.ts` — `buildReportDataSchema(template)` (derives a strict Zod schema for
      filled data from the snapshot), `validateReportData`, `computeResults` (entered values →
      flagged results map). `examples.ts` has the FBC fixture (`satisfies Template`).
- [x] Sanity-checked via tsx: parse, flagging, computeResults, strict reject, dup-key reject.
- [x] **Template storage + service** — `lib/report-templates/` (`listTemplates`, `getTemplate`
      parsing the snapshot, `createTemplate` v1, `updateTemplate` version-bump, `setTemplateActive`
      soft enable/disable). Each mutation = change + `template.*` audit in one tx, clinic-scoped.
      `report_templates` table already exists (no migration).
- [x] **Owner-only templates UI** (`(app)/templates`) — list, new, edit. Phase-1 JSON editor:
      paste/edit the template JSON, validated against `templateSchema` on save (first-issue
      detail surfaced). New starter skeleton; edit saves a new version + activate/deactivate.
      Topbar gains an owner **Templates** link.
- [x] **Form renderer + report create/verify** — `lib/reports/` (`createReport` freezes the
      snapshot, validates data, computes+stores flags, **gap-free `report_number`** via a
      per-clinic `pg_advisory_xact_lock`; `verifyReport` doctor/owner sign-off; `getReport`,
      `listReports`). `components/forms/ReportFormRenderer` auto-builds the entry form from the
      schema with **live flagging**; `components/organisms/ReportView` renders read-only from
      snapshot+data (flags read from storage, never recomputed).
- [x] Routes `(app)/reports`: index list, `new` (pick patient → pick template → fill), `[id]`
      view + verify. Wired into patient detail (reports list + New report); **Reports** nav link.
- [x] **PDF renderer** — `components/pdf/ReportDocument` (`@react-pdf/renderer`, branded:
      clinic header from the `clinics` row, patient block, results tables with flags/critical
      highlight, fields, signature, report number, DRAFT banner when unverified). Served via
      Route Handler `(app)/reports/[id]/pdf` (tenant-scoped, 401/404, inline application/pdf).
      `serverExternalPackages: ["@react-pdf/renderer"]` in next.config. Download link on the
      report view. Render verified via tsx (valid %PDF buffer).
- [ ] **Deferred:** editing a draft report's data (create + verify cover the core flow);
      optional QR encoding of the report number on the PDF.

Stage 2 is functionally complete. Heavy live verification (real templates, PDF look) happens
once the clinic-PC DB is up.

### Stage 1 — Patient registry (`src/lib/patients/` + `(app)/patients`) ✅
- [x] `lib/schema/patient.ts` — shared Zod schema (fullName + phone required; nic/gender/dob/
      address/notes optional; gender `male|female|other`; dob `YYYY-MM-DD`).
- [x] `lib/patients/index.ts` — `searchPatients` (phone/name `ilike`, recent when empty),
      `getPatient`, `findByPhone` (dedupe, `excludeId` for edits), `createPatient`/`updatePatient`
      (change + `patient.create`/`patient.update` audit in one tx). All clinic-scoped.
- [x] Routes: list + search (`/patients`), `new`, detail (`[id]`, with bills/reports history
      placeholders), `edit`. Server Actions dedupe by phone, redirect to the detail page.
- [x] Components: `SearchBar` molecule (GET form, no-JS search), `PatientTable` organism,
      shared `PatientForm` (new+edit, `useActionState`). Topbar gains a **Patients** link.
- [x] Forms follow the existing `useActionState` + Server Action pattern (react-hook-form is
      not installed; staying consistent with login/settings/team).

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

### Backups + restore (`src/lib/backup/` + `scripts/`) ✅
- [x] `lib/backup/crypto.ts` — streaming AES-256-GCM encrypt/decrypt (scrypt KDF, per-file
      salt; `[salt][iv][ciphertext][tag]`). Node-only, NOT `server-only` (runs under tsx).
- [x] `lib/backup/index.ts` — `createBackup` (`pg_dump -Fc` → encrypt → delete plaintext →
      optional `rclone copy` → prune to `BACKUP_KEEP`), `restoreBackup` (`pg_restore --clean
      --if-exists`), `downloadFromRemote`, `resolveBackupConfig`.
- [x] `scripts/backup.ts` (`npm run backup`) + `scripts/restore.ts` (`npm run restore --`,
      destructive, requires `--yes`; `--file` / `--from-remote` / `--database-url`).
- [x] `docs/backups.md` — setup (pg tools, rclone Google Drive), Windows Task Scheduler
      `schtasks` snippet, and the throwaway-DB **restore drill**. `.env.example` expanded;
      `backups/` gitignored.
- [ ] **Not yet exercised** — needs Postgres + `pg_dump`/`rclone` on the clinic PC. Run the
      restore drill in `docs/backups.md` before going live (Stage 5 non-negotiable).

### Team invites + first-login reset (`src/lib/users/` + routes) ✅
- [x] `lib/users/index.ts` — `listClinicUsers`, `createInvitedUser` (mustReset=true; insert +
      `user.create` audit in one tx), `setUserPassword` (clears mustReset + `auth.password_reset`
      audit in one tx), `emailExists`. Shared schemas in `lib/schema/user.ts`.
- [x] **Team page** (`(app)/team`, owner-only) — lists clinic users with Active / "Awaiting
      first login" status; invite form (name/email/role staff|doctor/temp password). Action
      re-checks owner role, pre-checks duplicate email, `revalidatePath`.
- [x] **First-login reset** (`/reset-password`, OUTSIDE the (app) group to avoid a redirect
      loop) — `(app)/layout.tsx` redirects any `mustReset` user here; page forces non-reset
      users on to `/dashboard`. `getCurrentUser` now carries `mustReset`.
- [x] Topbar gains an owner-only **Team** link.

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

## Next up (ordered)

Stages 0–4 code is complete. The next stage is **Stage 5 — Polish + real-data trial**
(`docs/roadmap.md`):

1. Run real patients / bills / reports through the app on the clinic PC; fix friction points.
2. Tighten audit logging and edge cases.
3. **Verify the Google Drive backup + restore drill end-to-end** (`docs/backups.md`) — the
   one Stage-5 non-negotiable still un-exercised.

**Verify live in the browser:** dashboard stat figures and the revenue report (date-range,
by-service totals, outstanding list, PDF + CSV exports) against real seeded data — only the
RevenueDocument render and the build have been checked so far, not the live aggregate queries.

**Local DB is up in Docker** (`suwa-db`, schema applied via Liquibase, owner seeded), so flows
can be exercised live in the browser. For a fresh clinic PC the setup is still: install Postgres
(or Docker), apply the schema, `npm run seed:owner`, and run the backup + restore drill
(`docs/backups.md`).

## Decisions & gotchas

- **Money** is integer minor units everywhere (LKR cents). Use `formatMoney`.
- **Patient lookup key = phone** (`unique(clinic_id, phone)`), NIC optional.
- `en.ts` is the canonical key set (no `as const` — values widened to `string`). **English
  only at launch**; the file-per-locale pattern is retained so `si`/`ta` can be added later
  without touching components. Add new keys to `en`.
- Brand palette has a single origin in `brand.ts`; don't put raw hex in components — use
  `bg-primary` / `text-ink` etc.
- No shadcn, no Clerk, no Vercel. Build from atoms up; mutations re-check role server-side.
