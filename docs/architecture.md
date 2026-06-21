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

The MVP is **self-hosted on the clinic's own PC** — no cloud provider, no Vercel, no
Clerk. The only outbound dependency is a nightly database backup to Google Drive. Every
choice below is deliberately cloud-agnostic so the app can later lift to any provider
without a rewrite (see roadmap "Migration path").

| Concern | Choice | Why |
|---------|--------|-----|
| Framework | **Next.js (App Router, standalone output)** | Full-stack: UI, API routes, and server-side PDF generation in one app; standalone build runs as a plain Node server on the clinic PC |
| Language | **TypeScript** | Type safety across schema-driven forms and PDFs |
| Database | **PostgreSQL** (installed locally on the clinic PC) | Relational integrity for financial/clinical records; JSONB for template schemas |
| DB access | **Drizzle (query/types) + Liquibase (migrations)** | Typed, SQL-close queries; schema changes are versioned in Liquibase changelogs, not ORM migrate |
| Auth | **Self-hosted credentials auth** | Email/username + password hashed (argon2/bcrypt), HTTP-only session cookies, server-side role checks. No third-party identity provider |
| PDF | **@react-pdf/renderer** | Programmatic, schema-driven PDFs; pure Node, no headless browser — runs fine on the local server |
| Drag-drop (later) | **dnd-kit** | Phase 3 template builder; same underlying schema |
| Validation | **Zod** | Validate template schemas and form input |
| Styling | **Tailwind CSS**, hand-built components | **No shadcn/ui.** Components follow **atomic design** (atoms → molecules → organisms → templates → pages) |
| Branding & i18n | **Centralized** (`lib/branding` + `lib/i18n`) | Product brand **Suwa**; all copy via `t()`. **English-only at launch** on the multi-locale file pattern (`si`/`ta` drop in later). No hard-coded names or strings. See `branding.md` |
| Hosting | **Clinic's PC (self-hosted Node server)** | No cloud at MVP; portable to any Node host/container later |
| Backups | **Nightly Google Drive upload** | `pg_dump` → encrypted dump → Google Drive (rclone or Drive API) via Windows Task Scheduler |

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

The **same schema-driven renderer** powers both report PDFs and invoice PDFs.

## 4. Project structure (planned)

```
clinic-management-system/
├── docs/                      # this documentation
├── src/
│   ├── app/
│   │   ├── (auth)/            # login (single-clinic; no public sign-up)
│   │   ├── (dashboard)/       # authenticated app shell
│   │   │   ├── patients/
│   │   │   ├── billing/
│   │   │   ├── reports/
│   │   │   ├── templates/     # template management (Phase 2+)
│   │   │   ├── catalog/       # services & prices
│   │   │   └── settings/
│   │   └── api/               # route handlers (PDF gen, mutations)
│   ├── components/            # atomic design — no component library
│   │   ├── atoms/             # Button, Input, Field, Badge, … (hand-built Tailwind)
│   │   ├── molecules/         # composed units (FormRow, SearchBar, …)
│   │   ├── organisms/         # PatientTable, BillEditor, report form renderer, …
│   │   ├── templates/         # page-level layouts / shells
│   │   └── pdf/               # @react-pdf document components
│   ├── lib/
│   │   ├── db/                # drizzle schema + client (queries/types)
│   │   ├── auth/              # password hashing, sessions, role guards
│   │   ├── branding/          # brand.ts — single source of truth (name, logo, colors)
│   │   ├── i18n/              # t(), locales/en.ts — centralized translations (English-only at launch)
│   │   ├── schema/            # template JSON schema types + Zod validators
│   │   ├── pdf/               # PDF builders (report, invoice)
│   │   ├── flagging/          # reference-range -> flag logic
│   │   ├── backup/            # pg_dump + Google Drive upload job
│   │   └── audit/             # audit-log helpers
│   └── types/
├── liquibase/                 # changelogs (master + per-change)
├── scripts/                   # setup (seed owner), backup, restore
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

At MVP there is a single environment: the clinic's PC. There are no preview/cloud envs.

| Env | Purpose |
|-----|---------|
| Local dev | Developer machine against a local Postgres |
| Clinic PC (production) | The live single-clinic instance; local Postgres + nightly Google Drive backups |

Secrets live in a local `.env` on the clinic PC (never committed). See `.env.example`.

### Cloud migration (later)
The stack is intentionally cloud-agnostic. To scale beyond one PC: restore the latest
dump into a managed Postgres, replay the **Liquibase** changelogs (identical schema),
point the connection string at it, and run the same Next.js standalone server on any Node
host/container. No Vercel/Clerk lock-in to unwind.
