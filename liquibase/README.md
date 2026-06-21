# Database migrations (Liquibase)

Liquibase is the **source of truth** for the Suwa schema. The Drizzle schema
(`src/lib/db/schema.ts`) mirrors it for typed queries — when you change one, change both.

## Layout

```
liquibase/
├── changelog/
│   ├── db.changelog-master.xml      # includes every change, in order
│   └── changes/
│       └── 001-initial-schema.sql   # formatted-SQL changeset
├── liquibase.properties.example     # copy to liquibase.properties (gitignored)
└── README.md
```

## One-time setup (clinic PC)

1. Install **PostgreSQL** locally and create the database + role:
   ```sql
   CREATE ROLE suwa LOGIN PASSWORD 'choose-a-password';
   CREATE DATABASE suwa OWNER suwa;
   ```
2. Install **Liquibase** (https://www.liquibase.com/download) and the PostgreSQL JDBC
   driver (bundled with recent Liquibase distributions).
3. `cp liquibase/liquibase.properties.example liquibase/liquibase.properties` and set the
   URL / username / password. Use the same database in `DATABASE_URL` (`.env`).

## Commands (run from the repo root)

```bash
npm run db:status     # show pending changesets
npm run db:migrate    # apply pending changesets (liquibase update)
npm run db:rollback   # roll back the last changeset
```

(Or call Liquibase directly: `liquibase --defaults-file=liquibase/liquibase.properties update`.)

## Adding a change

1. Add a new file `changelog/changes/NNN-description.sql` (formatted SQL with a
   `--changeset suwa:NNN-description` header). **Never edit a changeset that has already
   been applied** — add a new one.
2. `<include>` it in `db.changelog-master.xml`, after the previous change.
3. Update `src/lib/db/schema.ts` to match.
4. `npm run db:migrate`.

## Migrating to the cloud later

Point `liquibase.properties` (and `DATABASE_URL`) at the managed Postgres and run
`npm run db:migrate` — the same changesets replay identically. No schema rewrite.
