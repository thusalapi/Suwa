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

```bash
npm install
npm run dev   # http://localhost:3000
```

The app needs a PostgreSQL database. For local dev you can run one in Docker:

```bash
docker run -d --name suwa-db \
  -e POSTGRES_USER=suwa -e POSTGRES_PASSWORD=suwa -e POSTGRES_DB=suwa \
  -p 5432:5432 postgres:16
```

Then copy `.env.example` to `.env` (set `DATABASE_URL=postgresql://suwa:suwa@localhost:5432/suwa`
and a random `SESSION_SECRET`), apply the schema (`npm run db:migrate`, or run the Liquibase
changelog), and seed the first owner:

```bash
npm run seed:owner -- --clinic "Suwa Medical Centre" \
  --name "Dr. Perera" --email owner@clinic.lk --password "suwa12345"
```

#### Local dev login

> ⚠️ **Local development only** — throwaway credentials for the seeded dev database.
> Never use these in a real deployment; create real accounts via the **Team** page.

| Email | Password | Role |
|-------|----------|------|
| `owner@clinic.lk` | `suwa12345` | Owner |

Other staff/doctor accounts are created by the owner from the **Team** page (they set their
own password on first login).
