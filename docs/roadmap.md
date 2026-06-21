# Roadmap

Approach: **ship the engine before the editor**, validate continuously with the
design-partner clinic, and reach a chargeable product before adding breadth.

## Build sequence (~6 weeks to MVP)

### Stage 0 — Foundation (Week 1)
- Next.js + TypeScript + Tailwind + shadcn/ui project
- PostgreSQL (Vercel Marketplace) + Drizzle schema & migrations
- Clerk auth with roles (owner / staff / doctor); middleware-gated dashboard
- Clinic settings (name, logo, currency, tax rate)
- **Audit log helper + automated DB backups on from day one**
- Deploy skeleton to Vercel

### Stage 1 — Patient registry (Week 1–2)
- Add / search / edit patients
- Patient detail view (history placeholder for bills + reports)
- This is the shared backbone — everything references it

### Stage 2 — Report engine, Phase 1 (Week 2–4)  ← differentiator
- JSON template schema types + Zod validators
- Form renderer (auto-build data-entry form from schema)
- `results_table` with units + reference ranges + auto flagging
- Template snapshotting into each report
- Doctor verification / sign-off; report numbering
- PDF renderer for reports (branded, with report number / optional QR)
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
- Run real patients/reports through it at the clinic
- Fix the friction points they actually hit
- Tighten audit logging and edge cases

## Post-MVP (after first revenue)

- **Phase 2 report editor** — form-based template creation (staff self-serve)
- **Phase 3 report builder** — drag-and-drop canvas (`dnd-kit`)
- SMS / email notifications
- Appointments & scheduling
- Age/gender-specific reference ranges
- Multi-branch / multi-clinic
- Prescriptions, fuller medical records
- Inventory

## Explicitly out of scope for MVP

Drag-and-drop builder, appointments, prescriptions, full EMR/diagnoses, inventory, SMS,
insurance claims, multi-branch, variable reference ranges. (See requirements.md.)

## Non-negotiables (carry through every stage)

1. **Template snapshotting** — issued reports re-render exactly as released
2. **Audit log** — every create/edit/verify on bills and reports
3. **Doctor verification** before a report is released
4. **Automated DB backups** — clinical + financial data
5. **Money as integers**; gap-free sequential bill/report numbers
6. **Role checks server-side** on every mutation

## Validation cadence

- Demo to the clinic at the end of **Stage 2** (report PDF) and **Stage 3** (invoice).
  These are the "wow" moments and the best feedback loops.
- Let the clinic's real workflow reshuffle priorities — they are the design partner.

## Immediate next action

Capture the exact fields (tests, units, reference ranges) of the clinic's top 3–5
report types. Then begin Stage 0 scaffolding.
