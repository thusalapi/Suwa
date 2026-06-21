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

| Concern | Choice | Why |
|---------|--------|-----|
| Framework | **Next.js (App Router)** | Full-stack: UI, API routes, and server-side PDF generation in one app |
| Language | **TypeScript** | Type safety across schema-driven forms and PDFs |
| Database | **PostgreSQL** (Vercel Marketplace) | Relational integrity for financial/clinical records; JSONB for template schemas |
| ORM | **Drizzle** (or Prisma) | Typed schema + migrations; Drizzle is lighter and SQL-close |
| Auth | **Clerk** (Vercel Marketplace) | Fast role-based auth; offloads password security |
| PDF | **@react-pdf/renderer** | Programmatic, schema-driven PDFs; deploys cleanly on Vercel (no headless browser) |
| Drag-drop (later) | **dnd-kit** | Phase 3 template builder; same underlying schema |
| Validation | **Zod** | Validate template schemas and form input |
| Styling | **Tailwind CSS** + shadcn/ui | Fast, consistent UI |
| Hosting | **Vercel** | Zero-config Next.js deploys; managed Postgres + backups |

### Notes on platform choices
- Use **Fluid Compute** defaults on Vercel (full Node.js in functions/middleware).
- PDF generation runs server-side in a route handler / server action.
- Choose a Marketplace Postgres (e.g. Neon) so backups and branching are managed.

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
│   │   ├── (auth)/            # sign-in / sign-up
│   │   ├── (dashboard)/       # authenticated app shell
│   │   │   ├── patients/
│   │   │   ├── billing/
│   │   │   ├── reports/
│   │   │   ├── templates/     # template management (Phase 2+)
│   │   │   ├── catalog/       # services & prices
│   │   │   └── settings/
│   │   └── api/               # route handlers (PDF gen, mutations)
│   ├── components/
│   │   ├── ui/                # shadcn primitives
│   │   ├── forms/             # schema-driven form renderer
│   │   └── pdf/               # @react-pdf document components
│   ├── lib/
│   │   ├── db/                # drizzle schema, client, migrations
│   │   ├── schema/            # template JSON schema types + Zod validators
│   │   ├── pdf/               # PDF builders (report, invoice)
│   │   ├── flagging/          # reference-range -> flag logic
│   │   └── audit/             # audit-log helpers
│   └── types/
├── drizzle/                   # generated migrations
├── .env.example
└── package.json
```

## 5. Cross-cutting concerns

### Authorization
- Middleware gates the `(dashboard)` group.
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
- Enable managed Postgres automated backups on day one — non-negotiable for
  clinical + financial data.

## 6. Environments

| Env | Purpose |
|-----|---------|
| Local | Dev against a local or branched Postgres |
| Preview | Per-PR Vercel deploys with a branched DB |
| Production | The clinic's live instance with backups |

Secrets via `vercel env` / `.env` (never committed). See `.env.example`.
