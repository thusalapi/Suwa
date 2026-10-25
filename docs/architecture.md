# Technical Architecture

## 1. High-level shape

```
                  ┌──────────────────┐
                  │ Patient Registry  │   ← shared backbone
                  └────────┬──────────┘
            ┌──────────────┴──────────────┐
            ▼                              ▼
     ┌─────────────┐               ┌──────────────┐
     │   Billing    │               │ Report Engine │
     │ + Invoices   │               │  (templates)  │
     └──────┬──────┘               └──────┬────────┘
            └───────────┬──────────────────┘
                        ▼
              Shared PDF pipeline (@react-pdf/renderer)
```

Both billing and the report engine reference the same patient. Both produce PDFs
through one shared rendering pipeline.

## 2. Tech stack

The **pilot** runs on the clinic's own PC (Next.js server + local PostgreSQL, nightly
encrypted backup to Google Drive). That is not the production target: **production is a
hosted, multi-clinic deployment** — see [production-plan.md](production-plan.md). Every choice
below is deliberately cloud-agnostic (plain Node server, plain PostgreSQL, no Clerk or
proprietary APIs), so the move is configuration + data, not a rewrite.

| Concern | Choice | Why |
|---------|--------|-----|
| Framework | **Next.js (App Router, standalone output)** | Full-stack: UI, API routes, and server-side PDF generation in one app; standalone build runs as a plain Node server on the clinic PC |
| Language | **TypeScript** | Type safety across schema-driven forms and PDFs |
| Database | **PostgreSQL** (installed locally on the clinic PC) | Relational integrity for financial/clinical records; JSONB for template schemas |
| DB access | **Drizzle (query/types) + Liquibase (migrations)** | Typed, SQL-close queries; schema changes are versioned in Liquibase changelogs, not ORM migrate |
| Auth | **Self-hosted credentials auth** | Email/username + password hashed (argon2/bcrypt), HTTP-only session cookies, server-side role checks. No third-party identity provider |
| PDF | **@react-pdf/renderer** | Programmatic, schema-driven PDFs; pure Node, no headless browser — runs fine on the local server |
| Drag-drop | **dnd-kit** | Visual template builder (block/row reorder, canvas layout); same underlying schema |
| Validation | **Zod** | Validate template schemas and form input |
| Styling | **Tailwind CSS**, hand-built components | **No shadcn/ui.** Components follow **atomic design** (atoms → molecules → organisms → templates → pages) |
| Branding & i18n | **Centralized** (`lib/branding` + `lib/i18n`) | Product brand **Suwa**; all copy via `t()`. **English-only at launch** on the multi-locale file pattern (`si`/`ta` drop in later). No hard-coded names or strings. See `branding.md` |
| Hosting | **Pilot: clinic PC. Production: hosted** | Standalone Node server runs on any host/container; see production-plan.md |
| Backups | **Pilot: nightly Google Drive upload** | `pg_dump` → AES-256-GCM encrypted dump → Google Drive (rclone) via Task Scheduler. Production: managed backups + an independent encrypted dump |

### Notes on platform choices
- The app runs as a Next.js **standalone** server (`next build` → `node server.js`) on the
  clinic PC; no serverless/edge runtime assumptions.
- PDF generation runs server-side in a route handler / server action.
- PostgreSQL is a local install on the same PC (or LAN); connection via a local
  connection string in `.env`.
- **Liquibase** owns the schema: changelogs are applied on setup and on every update, and
  replay identically against a future managed Postgres during cloud migration.

## 3. Rendering & data flow

### Report creation flow
```
Select template ─► load schema ─► auto-generate data-entry form
       │                                   │
       │                          staff fills values
       ▼                                   ▼
freeze template_snapshot ──────► save report (status=draft, data JSON)
       │
       ▼
doctor verifies ─► status=verified ─► render PDF from (snapshot + data)
```

### Billing flow
```
Select patient ─► add line items (catalog or free text)
       │              │ snapshot price/description onto line
       ▼              ▼
apply discount/tax ─► compute totals ─► record payment(s)
       │
       ▼
assign sequential bill_number ─► render branded PDF invoice
```

The **same PDF pipeline** powers report PDFs, the A4 invoice, the **80 mm POS receipt**
(`components/pdf/BillReceipt.tsx`, page length sized to its content) and the revenue PDF. Every
printed document uses the clinic's header from Settings and ends with the clinic's **footer
line** (Settings → Footer text); no app branding is printed.

### Visits
A patient's reports and bills are grouped into **visits by day** on the patient page
(`lib/visits.ts`). Visits are derived, not stored — see data-model.md.

## 4. Project structure

```
clinic-management-system/
├── docs/                         # this documentation
├── src/
│   ├── app/
│   │   ├── (auth)/login/         # sign in (no public sign-up)
│   │   ├── (app)/                # authenticated shell (gated by proxy.ts)
│   │   │   ├── dashboard/ patients/ reports/ bills/ services/
│   │   │   ├── templates/        # template list, visual builder, locked preview
│   │   │   ├── revenue/          # revenue report + CSV/PDF exports (owner)
│   │   │   ├── team/ settings/   # owner admin
│   │   │   └── …/pdf, bills/[id]/receipt   # PDF route handlers
│   │   └── reset-password/       # first-login password set
│   ├── components/               # atomic design — no component library
│   │   ├── atoms/ molecules/ organisms/ templates/
│   │   ├── forms/                # ReportFormRenderer (schema → form)
│   │   └── pdf/                  # ReportDocument, BillDocument, BillReceipt, RevenueDocument
│   └── lib/
│       ├── report-engine/        # template schema, formulas, flagging, display, templates (examples.ts)
│       ├── reports/ report-templates/ bills/ patients/ catalog/ clinic/ users/
│       ├── dashboard/ analytics/ visits.ts
│       ├── db/                   # drizzle schema + client
│       └── auth/ audit/ backup/ branding/ i18n/ design/ schema/ utils/
├── liquibase/changelog/          # migrations 001–005 (source of truth)
├── scripts/                      # migrate, seed-owner, seed-templates, seed-demo, backup, restore, install.ps1
├── test/ e2e/                    # Vitest unit + integration, Playwright journeys
├── .env.example
└── package.json
```

## 5. Cross-cutting concerns

### Authorization
- Self-hosted credentials auth: passwords hashed with argon2/bcrypt; login issues a
  signed, HTTP-only session cookie.
- Middleware resolves the user + role from the session and gates the `(dashboard)` group.
- The first **owner** account is created by a one-time setup script (no public sign-up —
  single-clinic install); owner invites staff/doctor from settings.
- Every mutation re-checks the user's role server-side. Never trust the client.

### Audit logging
- A single `recordAudit(action, entity, id, metadata)` helper called inside every
  create/edit/verify mutation, in the same transaction as the change.

### Reproducibility (the most important rule)
- **Reports** freeze `template_snapshot` (the full schema JSON at creation time).
- **Bills** snapshot price + description onto each line item.
- Re-rendering a PDF reads only the frozen data, never the live catalog/template.

### Money & numbering
- All monetary values are integers (smallest currency unit).
- `bill_number` and `report_number` are sequential per clinic, generated atomically
  (DB sequence or `SELECT ... FOR UPDATE`), gap-free.

### Backups
- A **nightly job** (`lib/backup/` + a `scripts/` entry, scheduled via Windows Task
  Scheduler) runs `pg_dump`, encrypts the dump, and uploads it to **Google Drive**
  (rclone or the Drive API). Non-negotiable for clinical + financial data from day one.
- A documented **restore drill** is part of Stage 5 — a backup that can't be restored
  isn't a backup.

## 6. Environments

| Env | Purpose |
|-----|---------|
| Local dev | Developer machine against a local Postgres |
| Pilot (clinic PC) | Single-clinic instance; local Postgres + nightly Google Drive backups ([runbook.md](runbook.md)) |
| Staging / Production (planned) | Hosted, multi-clinic — see [production-plan.md](production-plan.md) |

Secrets live in a local `.env` on the clinic PC (never committed). See `.env.example`.

### Moving to hosted production
Restore the latest dump into a managed Postgres, apply the changelogs (`npm run db:deploy`),
point `DATABASE_URL` at it, and run the same Next.js server on the chosen host. The full plan,
including the code changes a hosted, multi-clinic setup needs first, is in
[production-plan.md](production-plan.md).
