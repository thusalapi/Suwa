# Roadmap

Approach: **ship the engine before the editor**, validate continuously with the
design-partner clinic, and reach a chargeable product before adding breadth.

**Deployment philosophy:** the MVP runs entirely on the **clinic's own PC** — no cloud
provider, no Vercel. Postgres runs locally; the only outbound dependency is a nightly
**database backup to Google Drive**. This keeps the MVP cheap, private, and fully under
the clinic's control. Once validated, the same app + database can be lifted to a cloud
provider with no code rewrite (see "Migration path" below).

## Stack decisions (locked for MVP)

| Concern | Choice | Notes |
|---------|--------|-------|
| UI | **Tailwind CSS, hand-built components** | **No shadcn/ui.** Components organized by **atomic design** (atoms → molecules → organisms → templates → pages). |
| Branding & i18n | **Centralized** | Product brand **Suwa**; all copy via `t()`. **English-only at launch**, but built on the multi-locale file pattern so `si`/`ta` drop in later. No hard-coded names/strings. See `branding.md`. |
| Auth | **Self-hosted credentials auth** | **No Clerk.** Email/username + password, hashed (argon2/bcrypt), HTTP-only session cookies, server-side role checks. |
| DB migrations | **Liquibase** | Versioned changelogs, runs against local Postgres. **Not** Drizzle/Prisma migrate. |
| Patient identity | **Phone number is the lookup key** | Unique per clinic. **NIC is optional.** UUID stays as the internal PK. |
| Hosting | **Client's PC (self-hosted)** | Next.js standalone server + local PostgreSQL. No Vercel. |
| Backups | **Nightly Google Drive upload** | `pg_dump` → encrypted dump → Google Drive (rclone or Drive API), via Windows Task Scheduler. |

## Build sequence (~6 weeks to MVP)

### Stage 0 — Foundation (Week 1)
- Next.js + TypeScript + Tailwind project (standalone output for self-hosting)
- **Atomic component structure** scaffolded: `atoms/`, `molecules/`, `organisms/`,
  `templates/`. No component library — primitives (Button, Input, Field, Badge…) are
  hand-built with Tailwind.
- **Centralized branding** (`lib/branding/brand.ts` — product brand **Suwa**, logo,
  palette) and **centralized translations** (`lib/i18n`, **English-only at launch** on the
  multi-locale file pattern) from the first screen. No hard-coded brand names or
  user-facing strings. See `branding.md`.
- **Local PostgreSQL** install + connection; **Liquibase** changelog with initial schema
- **Self-hosted auth flow** (see below) with roles (owner / staff / doctor); session
  middleware gates the dashboard
- Clinic settings (name, logo, currency, tax rate)
- **Audit log helper + nightly Google Drive backup job on from day one**
- Run skeleton locally on the clinic PC (no cloud deploy)

#### Auth flow (Stage 0 detail)
- **Seed the first owner account** via a one-time CLI/setup script (no public sign-up —
  this is a single-clinic install).
- Owner invites staff/doctor accounts from settings; passwords set on first login.
- Login → verify hash → issue signed, HTTP-only session cookie → middleware resolves
  user + role on every request.
- Every mutation re-checks role **server-side**. Logout clears the session.
- No external identity provider; all credentials live in the local DB.

### Stage 1 — Patient registry (Week 1–2)
- Add / search / edit patients — **search and dedupe by phone number** (primary lookup)
- **NIC is an optional field**, not required to create a patient
- Patient detail view (history placeholder for bills + reports)
- This is the shared backbone — everything references it

### Stage 2 — Report engine, Phase 1 (Week 2–4)  ← differentiator
- JSON template schema types + Zod validators
- Form renderer (auto-build data-entry form from schema)
- `results_table` with units + reference ranges + auto flagging
- Template snapshotting into each report
- Doctor verification / sign-off; report numbering
- PDF renderer for reports (branded, with report number / optional QR) — runs in the
  local Node server, no headless browser
- Hand-build the clinic's first 3–5 templates **with them**

### Stage 3 — Billing (Week 4–5)
- Service / price catalog
- Create bill → itemized items (catalog or free text, snapshotted)
- Discount, tax, totals; partial payments
- Branded PDF invoice / receipt (reuses the PDF pipeline)
- Sequential bill numbering

### Stage 4 — Dashboard & reporting (Week 5–6)
- Owner dashboard: revenue today, bills today, pending reports, outstanding balances
- Date-range revenue report; breakdown by service; outstanding payments
- Export PDF / CSV

### Stage 5 — Polish + real-data trial (Week 6)
- Run real patients/reports through it on the clinic PC
- Fix the friction points they actually hit
- Tighten audit logging and edge cases
- **Verify the Google Drive backup + restore drill end-to-end**

## Migration path (post-MVP, when scaling beyond one PC)

The app is built cloud-agnostic on purpose. To scale later:
1. Stand up a managed PostgreSQL (any provider) and **restore the latest dump** into it.
2. Point the app's connection string at the managed DB; **Liquibase changelogs replay
   identically** — no schema rewrite.
3. Host the Next.js standalone server on any Node host / container (not tied to Vercel).
4. Repurpose the Google Drive backup job, or switch to the provider's managed backups.

Because there is no Vercel/Clerk lock-in, migration is config + data, not a rebuild.

## Post-MVP (after first revenue)

- ~~**Phase 2 report editor** — form-based template creation (staff self-serve)~~ — **done**
  (pulled forward): visual `TemplateBuilder` replaced the Phase-1 JSON editor.
- ~~**Phase 3 report builder** — drag-and-drop canvas (`dnd-kit`)~~ — **done** (pulled forward):
  dnd-kit drag-to-reorder for blocks and results-table rows.
- Cloud migration (see above) for multi-PC / remote access
- SMS / email notifications
- Appointments & scheduling
- Age/gender-specific reference ranges
- Multi-branch / multi-clinic
- Prescriptions, fuller medical records
- Inventory

## Explicitly out of scope for MVP

Cloud deployment, drag-and-drop builder, appointments, prescriptions, full EMR/diagnoses,
inventory, SMS, insurance claims, multi-branch, variable reference ranges.
(See requirements.md.)

## Non-negotiables (carry through every stage)

1. **Template snapshotting** — issued reports re-render exactly as released
2. **Audit log** — every create/edit/verify on bills and reports
3. **Doctor verification** before a report is released
4. **Nightly DB backup to Google Drive** — clinical + financial data; restore tested
5. **Money as integers**; gap-free sequential bill/report numbers
6. **Role checks server-side** on every mutation
7. **Phone number as the patient lookup key**; NIC optional
8. **No cloud lock-in** — runs on the clinic PC, portable to any provider later
9. **Centralized branding & translations** — no hard-coded brand name or user-facing
   string; everything via `lib/branding` + `lib/i18n` (English-only at launch, multi-locale
   file pattern kept so more languages drop in later)

## Validation cadence

- Demo to the clinic at the end of **Stage 2** (report PDF) and **Stage 3** (invoice).
  These are the "wow" moments and the best feedback loops.
- Let the clinic's real workflow reshuffle priorities — they are the design partner.

## Immediate next action

Capture the exact fields (tests, units, reference ranges) of the clinic's top 3–5
report types. Then begin Stage 0 scaffolding (local Postgres + Liquibase + atomic
Tailwind components + self-hosted auth).
