# Roadmap

Approach: **ship the engine before the editor**, validate continuously with the
design-partner clinic, and reach a chargeable product before adding breadth.

**Deployment:** the **pilot** ran on the clinic's own PC (local Postgres, nightly encrypted
backup to Google Drive) to validate the product cheaply. **Production moves to AWS, reachable
only over Tailscale** (no public endpoint; one shared, multi-clinic install) — one install per
clinic PC does not scale to more customers, remote support, or reliable backups. The plan is in
[production-plan.md](production-plan.md) and the setup steps in
[deploy/aws/README.md](../deploy/aws/README.md). The code for it is merged; the infrastructure
is not provisioned yet. The stack stays cloud-agnostic, so this is configuration + data, not a
rewrite.

## Stack decisions (locked for MVP)

| Concern | Choice | Notes |
|---------|--------|-------|
| UI | **Tailwind CSS, hand-built components** | **No shadcn/ui.** Components organized by **atomic design** (atoms → molecules → organisms → templates → pages). |
| Branding & i18n | **Centralized** | Product brand **Suwa**; all copy via `t()`. **English-only at launch**, but built on the multi-locale file pattern so `si`/`ta` drop in later. No hard-coded names/strings. See `branding.md`. |
| Auth | **Self-hosted credentials auth** | **No Clerk.** Email/username + password, hashed (argon2/bcrypt), HTTP-only session cookies, server-side role checks. |
| DB migrations | **Liquibase** | Versioned changelogs, runs against local Postgres. **Not** Drizzle/Prisma migrate. |
| Patient identity | **Phone number is the lookup key** | Unique per clinic. **NIC is optional.** UUID stays as the internal PK. |
| Hosting | **Pilot: client's PC → production: AWS + Tailscale** | Next.js standalone server in Docker on EC2 + RDS PostgreSQL (ap-south-1); clinics reach it only over Tailscale. See production-plan.md |
| Backups | **Nightly encrypted dump, off-site** | `pg_dump` → encrypted dump → rclone. Pilot: Google Drive via Windows Task Scheduler. Production: S3 via a systemd timer, plus RDS point-in-time recovery. |

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

## Hosted production (AWS + Tailscale)

Plan: [production-plan.md](production-plan.md). Setup: [deploy/aws/README.md](../deploy/aws/README.md).

**Code — done (Oct 2026, merged):**
- Clinic **time zone** (`APP_TIMEZONE`, default Asia/Colombo) so a UTC server shows Sri Lanka time
- **Sign-in rate limiting** stored in the database (5 failures per email / 20 per IP in 15 min)
- **Multi-clinic provisioning** (`clinic:create`; `seed:templates -- --clinic` / `--all-clinics`)
- Tenant-isolation fix: a bill can't reference another clinic's patient or service
- Build needs no database; `/api/health`; `Dockerfile` (app + tools images)
- `deploy/aws/`: Docker Compose with a Tailscale sidecar (HTTPS via `tailscale serve`, Funnel
  off), access policy (clinic PCs → app:443 only), nightly S3 backup timer

**Pilot first, on a free single server.** The pilot clinic runs on one free VM — Google
Cloud's e2-micro (current choice; 1 GB, US region, images built by GitHub Actions) or Oracle
Cloud Always Free ARM (app + PostgreSQL + Tailscale in one Compose stack, nightly encrypted dumps copied
off-site): [deploy/single-server/README.md](../deploy/single-server/README.md). Same image, same Tailscale
policy; the trade-off is one disk (restore = last night's backup) and no provider guarantee. The
AWS steps below are the target once there is revenue or a second clinic.

**Infrastructure (AWS) — to do:**
1. Create the tailnet; apply the access policy; create the server and clinic auth keys
2. Provision AWS: VPC, RDS PostgreSQL 17, S3 backup bucket + instance role, EC2 (no inbound ports)
3. First Docker image build and start (not yet built anywhere); `db:deploy`
4. Backup + **restore drill** on the new setup
5. Move the pilot clinic's data across; install Tailscale on its front-desk PCs
6. Keep the old clinic PC read-only for 30 days, then wipe it

**Code — still open** (production-plan.md): audit log viewer, session revocation, CI/CD,
tenant-isolation tests, per-clinic time zone, password reset.

## Post-MVP (after first revenue)

- ~~**Phase 2 report editor** — form-based template creation (staff self-serve)~~ — **done**
  (pulled forward): visual `TemplateBuilder` replaced the Phase-1 JSON editor.
- ~~**Phase 3 report builder** — drag-and-drop canvas (`dnd-kit`)~~ — **done** (pulled forward):
  dnd-kit drag-to-reorder for blocks and results-table rows.
- Real visit records (separate same-day visits, move a report between visits)
- Audit log viewer for the owner
- SMS / email notifications
- Appointments & scheduling
- Age/gender-specific reference ranges (per-row ranges by sex/age)
- Multi-branch (several clinics in one database is already supported; branches of one clinic are not)
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
4. **Nightly encrypted off-site DB backup** (pilot: Google Drive; production: S3) — clinical +
   financial data; restore tested
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
2. Pilot hosting at zero cost: create the tailnet and a Google Cloud free e2-micro server
   (deploy/single-server/README.md §1–3); build the image there.
3. Run the restore drill, then move the pilot clinic onto it.
4. Move to AWS + RDS (deploy/aws/README.md) when a second clinic joins or a day of data loss
   stops being acceptable.
