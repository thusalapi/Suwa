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
| [docs/branding.md](docs/branding.md) | Brand identity + centralized branding & translations (en/si/ta) |
| [docs/roadmap.md](docs/roadmap.md) | Build sequence, stages, and what's deliberately out of scope |

Build conventions for code generation live in the project skills under `.claude/skills/`:

| Skill | Scope |
|-------|-------|
| [`suwa-build`](.claude/skills/suwa-build/SKILL.md) | Master conventions — the locked stack & architecture decisions |
| [`suwa-frontend`](.claude/skills/suwa-frontend/SKILL.md) | UI standards — React/Tailwind/atomic design/branding/i18n |
| [`suwa-backend`](.claude/skills/suwa-backend/SKILL.md) | Server standards — actions, Drizzle/Liquibase, auth, audit, backups |

## Status

Planning / pre-development. See the roadmap for the build sequence.
