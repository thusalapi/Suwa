# Roadmap

Approach: **ship the engine before the editor**, validate continuously with the
design-partner clinic, and reach a chargeable product before adding breadth.

**Deployment:** the **pilot** ran on the clinic's own PC (local Postgres, nightly encrypted
backup to Google Drive) to validate the product cheaply. **Production moves to hosted,
multi-clinic infrastructure** — one install per clinic PC does not scale to more customers,
remote support, or reliable backups. The plan and the code changes it needs are in
[production-plan.md](production-plan.md). The stack was built cloud-agnostic, so this is
configuration + data, not a rewrite.

## Stack decisions (locked for MVP)

| Concern | Choice | Notes |
|---------|--------|-------|
| UI | **Tailwind CSS, hand-built components** | **No shadcn/ui.** Components organized by **atomic design** (atoms → molecules → organisms → templates → pages). |
| Branding & i18n | **Centralized** | Product brand **Suwa**; all copy via `t()`. **English-only at launch**, but built on the multi-locale file pattern so `si`/`ta` drop in later. No hard-coded names/strings. See `branding.md`. |
| Auth | **Self-hosted credentials auth** | **No Clerk.** Email/username + password, hashed (argon2/bcrypt), HTTP-only session cookies, server-side role checks. |
| DB migrations | **Liquibase** | Versioned changelogs, runs against local Postgres. **Not** Drizzle/Prisma migrate. |
| Patient identity | **Phone number is the lookup key** | Unique per clinic. **NIC is optional.** UUID stays as the internal PK. |
| Hosting | **Pilot: client's PC → production: hosted** | Next.js standalone server + PostgreSQL; see production-plan.md |
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

## Done since the MVP stages (pilot clinic, Oct 2026)

- The clinic's 23 report types as **locked templates** matching its printed reports, with
  **calculated results** (formula engine), REMARKS columns, notes, risk tables, and a
  searchable report picker (short names like PPBS, LFT, HbA1c)
- Patient **age** entry when the birth date is unknown (eGFR uses age + sex)
- **80 mm POS receipts**; date + time on bills; specimen time defaults to now
- Clinic **footer line** on every printed document; no app branding printed
- Patient **visits** (reports + bills grouped by day)

## Next: hosted production

See [production-plan.md](production-plan.md): hosting choice, the code changes needed first
(time zone, multi-clinic provisioning, login rate limiting, audit log viewer…), backups,
monitoring, data protection, and moving the pilot clinic's data across.

## Post-MVP (after first revenue)

- ~~**Phase 2 report editor** — form-based template creation (staff self-serve)~~ — **done**
  (pulled forward): visual `TemplateBuilder` replaced the Phase-1 JSON editor.
- ~~**Phase 3 report builder** — drag-and-drop canvas (`dnd-kit`)~~ — **done** (pulled forward):
  dnd-kit drag-to-reorder for blocks and results-table rows.
- Hosted production (see production-plan.md)
- Real visit records (separate same-day visits, move a report between visits)
- Audit log viewer for the owner
- SMS / email notifications
- Appointments & scheduling
- Age/gender-specific reference ranges (per-row ranges by sex/age)
- Multi-branch / multi-clinic
- Prescriptions, fuller medical records
- Inventory

## Explicitly out of scope for MVP

Appointments, prescriptions, full EMR/diagnoses, inventory, SMS, insurance claims,
multi-branch, variable reference ranges. (The drag-and-drop builder was pulled forward and is
done; hosting is now the next step, not out of scope.)
(See requirements.md.)

## Non-negotiables (carry through every stage)

1. **Template snapshotting** — issued reports re-render exactly as released
2. **Audit log** — every create/edit/verify on bills and reports
3. **Doctor verification** before a report is released
4. **Nightly DB backup to Google Drive** — clinical + financial data; restore tested
5. **Money as integers**; gap-free sequential bill/report numbers
6. **Role checks server-side** on every mutation
7. **Phone number as the patient lookup key**; NIC optional
8. **No cloud lock-in** — plain Node + PostgreSQL; the hosting provider stays replaceable
9. **Centralized branding & translations** — no hard-coded brand name or user-facing
   string; everything via `lib/branding` + `lib/i18n` (English-only at launch, multi-locale
   file pattern kept so more languages drop in later)

## Validation cadence

- Demo to the clinic at the end of **Stage 2** (report PDF) and **Stage 3** (invoice).
  These are the "wow" moments and the best feedback loops.
- Let the clinic's real workflow reshuffle priorities — they are the design partner.

## Immediate next action

1. Confirm the open calculation questions with the clinic (verification sheet).
2. Make the time zone explicit and add login rate limiting (production-plan.md §4, blockers).
3. Stand up staging, then move the pilot clinic onto hosted production.
