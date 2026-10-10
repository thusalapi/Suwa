# Suwa

**Suwa** (Sinhala සුව — "health / wellness") — *"Health, managed."*

A self-hosted clinic management system for small medical / diagnostic centers. Two cores
built on a shared patient registry:

1. **Billing & invoicing** — itemized bills, payments, branded PDF receipts.
2. **Self-service report engine** — staff create lab report templates (blood, urine,
   etc.) and fill them in to produce verified, branded PDF reports.

Target customer: small "mixed" centers that do **both consultations and lab tests**.
The first customer is a real clinic acting as a design partner.

## Why this exists

Many small centers in Sri Lanka still run billing and report generation on paper,
Excel, and printed templates. This product replaces that with a fast, professional,
auditable workflow — and lets the clinic define its own report types without
developer involvement.

## Guiding principles

- **Ship the engine before the editor.** A schema-driven report engine reaches
  revenue first; the drag-and-drop builder is a later upgrade on the same schema.
- **Reproducibility is sacred.** A report or bill must always re-render exactly as it
  was issued, even after templates or prices change.
- **One workflow end to end** before adding breadth. Resist scope creep.

## Documentation

| Doc | Purpose |
|-----|---------|
| [docs/requirements.md](docs/requirements.md) | Functional & non-functional requirements, scope, user roles |
| [docs/architecture.md](docs/architecture.md) | System architecture, tech stack, project structure |
| [docs/data-model.md](docs/data-model.md) | Database schema, tables, relationships, key decisions |
| [docs/report-engine.md](docs/report-engine.md) | The template schema + renderer (the core differentiator) |
| [docs/branding.md](docs/branding.md) | Brand identity + centralized branding & translations (English-only at launch, multi-locale pattern) |
| [docs/design-system.md](docs/design-system.md) | Token-driven, themeable design system + Claude Design sync + SaaS extraction path |
| [docs/roadmap.md](docs/roadmap.md) | Build sequence, stages, and what's deliberately out of scope |
| [docs/backups.md](docs/backups.md) | Nightly encrypted backup + off-site copy, scheduling, and the restore drill |
| [docs/runbook.md](docs/runbook.md) | Clinic-PC install / run / update / recovery runbook (operations) |

Build conventions for code generation live in the project skills under `.claude/skills/`:

| Skill | Scope |
|-------|-------|
| [`suwa-build`](.claude/skills/suwa-build/SKILL.md) | Master conventions — the locked stack & architecture decisions |
| [`suwa-frontend`](.claude/skills/suwa-frontend/SKILL.md) | UI standards — React/Tailwind/atomic design/branding/i18n |
| [`suwa-backend`](.claude/skills/suwa-backend/SKILL.md) | Server standards — actions, Drizzle/Liquibase, auth, audit, backups |

## Status

In development. See **[PROGRESS.md](PROGRESS.md)** for the live build log (what exists,
what's next); it's the first thing to read when picking the work back up. See the
[roadmap](docs/roadmap.md) for the full build sequence.

### Run locally

Requires **Node.js 20.12+** (the scripts use `process.loadEnvFile`) and a **PostgreSQL**
database. For local dev you can run one in Docker:

```bash
docker run -d --name suwa-db \
  -e POSTGRES_USER=suwa -e POSTGRES_PASSWORD=suwa -e POSTGRES_DB=suwa \
  -p 5432:5432 postgres:16
```

Then:

```bash
npm install
cp .env.example .env     # set DATABASE_URL + a random SESSION_SECRET
npm run db:deploy        # apply the schema
npm run seed:owner -- --clinic "Suwa Medical Centre" \
  --name "Dr. Perera" --email owner@clinic.lk --password "suwa12345"
npm run dev              # http://localhost:3000
```

Optionally, `npm run seed:demo` loads a ready-to-demo dataset — services, patients, bills in
mixed payment states, and reports (verified plus one awaiting sign-off). It **resets** the
clinic's demo rows each run, so it is safe to re-run between demos.

> **Applying the schema:** `npm run db:deploy` runs the changesets with plain Node and is the
> command to use on any machine. Liquibase remains the source of truth for *authoring*
> migrations (`npm run db:migrate`), but it needs a JVM and — contrary to its own docs — its
> Windows installer ships no PostgreSQL JDBC driver, so it fails on a fresh machine until a
> jar is added to its classpath. See [`liquibase/README.md`](liquibase/README.md).

### Commands

| Command | What |
|---------|------|
| `npm run dev` / `npm run build` / `npm run start` | Dev server · production build · serve the build |
| `npm run typecheck` · `npm run lint` · `npm run format` | TypeScript · ESLint · Prettier |
| `npm test` · `npm run test:integration` | Unit tests (no DB) · DB-backed tests (needs Postgres) |
| `npm run e2e` (`:headed`, `:ui`, `:report`) | Playwright end-to-end — seed first with `npm run seed:e2e` |
| `npm run db:deploy` (`-- --status`) | Apply pending changesets · list them |
| `npm run seed:owner` · `seed:templates` · `seed:demo` | First owner · sample report templates · full demo dataset |
| `npm run backup` · `npm run restore` | Encrypted `pg_dump` · restore from one |

### Deploying to a clinic PC

The target deployment is a single Windows PC running the app and PostgreSQL locally.
`scripts/install.ps1` does it in one pass — installs Node + PostgreSQL, creates the database,
generates real secrets, migrates, seeds the owner, builds, and registers the startup and
nightly-backup scheduled tasks:

```powershell
.\scripts\install.ps1 -ClinicName "Clinic Name" -OwnerName "Owner" -OwnerEmail owner@clinic.lk
```

Full operational detail — updates, backups, and recovery — is in
[docs/runbook.md](docs/runbook.md).

#### Local dev login

| Email | Password | Role |
|-------|----------|------|
| `owner@clinic.lk` | `suwa12345` | Owner |

Other staff/doctor accounts are created by the owner from the **Team** page (they set their
own password on first login).
