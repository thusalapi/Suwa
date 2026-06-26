# Clinic PC runbook

How to install, run, back up, and recover **Suwa** on the clinic's own Windows PC. This is
the operational companion to the architecture docs — it assumes the app is already built and
focuses on standing it up and keeping it running.

> **Deployment model:** everything runs locally on one PC — the Next.js app and a local
> PostgreSQL. The only outbound dependency is the nightly encrypted backup to Google Drive.
> No cloud, no Vercel. (See `docs/roadmap.md`.)

Related docs: [`liquibase/README.md`](../liquibase/README.md) (schema migrations) ·
[`docs/backups.md`](backups.md) (backup + restore) · [`PROGRESS.md`](../PROGRESS.md) (build log).

---

## 1. Prerequisites (install once)

| Tool | Why | Notes |
|------|-----|-------|
| **Node.js 20.12+** (LTS 22 or 24 recommended) | Runs the app + scripts | `node -v`. 20.12+ is required for `process.loadEnvFile`. |
| **PostgreSQL 16** | The database | Install the server **and** the client tools (`pg_dump`, `pg_restore`). |
| **Liquibase** | Applies the schema | <https://www.liquibase.com/download>. Bundles the Postgres JDBC driver. |
| **rclone** *(optional)* | Off-site backup copy to Google Drive | <https://rclone.org/downloads/>. Only needed for off-site backups. |
| **Git** *(optional)* | Pull app updates | Or copy the project folder manually. |

**PATH check** — open a fresh PowerShell and confirm each resolves:

```powershell
node -v ; npm -v
pg_dump --version ; pg_restore --version
liquibase --version
rclone version            # optional
```

If `pg_dump`/`pg_restore` are "not recognized", add the PostgreSQL `bin` directory
(e.g. `C:\Program Files\PostgreSQL\16\bin`) to the system PATH and reopen PowerShell.

---

## 2. First-time install

### 2.1 Get the code

```powershell
# clone, or copy the project folder onto the clinic PC
cd C:\Users\Thusala\Desktop\clinic-management-system
npm install
```

### 2.2 Create the database + role

In `psql` (or pgAdmin), connected as a superuser:

```sql
CREATE ROLE suwa LOGIN PASSWORD 'choose-a-strong-password';
CREATE DATABASE suwa OWNER suwa;
```

### 2.3 Configure environment (`.env`)

Copy the template and fill it in. **`.env` is gitignored — never commit it.**

```powershell
Copy-Item .env.example .env
```

Set at minimum:

```ini
DATABASE_URL=postgresql://suwa:choose-a-strong-password@localhost:5432/suwa
SESSION_SECRET=<long random string>           # e.g. node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
DEFAULT_LOCALE=en
BACKUP_ENCRYPTION_KEY=<long random string, min 16 chars>   # REQUIRED for backups
# optional off-site backup:
# BACKUP_RCLONE_REMOTE=gdrive:suwa-backups
# BACKUP_KEEP=14
```

> **Keep a copy of `BACKUP_ENCRYPTION_KEY` somewhere off the clinic PC.** Without it, the
> encrypted dumps cannot be decrypted — losing the key loses every backup.

### 2.4 Apply the schema (Liquibase)

```powershell
Copy-Item liquibase\liquibase.properties.example liquibase\liquibase.properties
# edit url / username / password to match DATABASE_URL, then:
npm run db:status     # shows pending changesets
npm run db:migrate    # applies them
```

(Full detail: [`liquibase/README.md`](../liquibase/README.md).)

### 2.5 Seed the first owner

There is no public sign-up. Create the clinic + owner once (refuses to run if an owner
already exists). Use a **real strong password**:

```powershell
npm run seed:owner -- --clinic "Clinic Name" --name "Owner Name" --email owner@clinic.lk --password "a-strong-password"
```

The owner then invites staff/doctor accounts from the **Team** page (each sets their own
password on first login). Owner clinic identity, currency, and tax rate are set on the
**Settings** page.

### 2.6 Build

```powershell
npm run build
```

> The build connects to the database (the DB client opens a connection at import), so
> PostgreSQL must be running and `.env` configured before building.

---

## 3. Running the app

### 3.1 Start it

From the repo root:

```powershell
npm run start        # serves on http://localhost:3000
```

Open <http://localhost:3000> → it redirects to `/login`. Sign in as the owner.

To serve on the local network (so other front-desk PCs can reach it), bind all interfaces
and pick a port:

```powershell
$env:PORT = "3000"
npx next start -H 0.0.0.0 -p 3000
```

Then staff browse to `http://<clinic-pc-ip>:3000`. (Allow the port through Windows Firewall.)

### 3.2 Start automatically on boot (Windows Task Scheduler)

Run the server at logon/startup so the clinic doesn't start it by hand. From an **elevated**
PowerShell:

```powershell
schtasks /Create /TN "Suwa App" /SC ONSTART /RL HIGHEST ^
  /TR "cmd /c cd /d C:\Users\Thusala\Desktop\clinic-management-system && npm run start >> logs\app.log 2>&1"
```

Manage it:

```powershell
schtasks /Run   /TN "Suwa App"          # start now
schtasks /End   /TN "Suwa App"          # stop
schtasks /Query /TN "Suwa App" /V /FO LIST
```

(`logs\` is gitignored-friendly; create it with `mkdir logs` if missing. For a more robust
service with auto-restart, NSSM — <https://nssm.cc> — can run `npm run start` as a Windows
service.)

---

## 4. Backups (non-negotiable)

Full setup, scheduling, and the restore drill are in [`docs/backups.md`](backups.md). Summary:

```powershell
npm run backup        # pg_dump → AES-256-GCM encrypt → backups\suwa-<ts>.dump.enc → (rclone copy)
```

Schedule it nightly (elevated PowerShell):

```powershell
schtasks /Create /TN "Suwa Nightly Backup" /SC DAILY /ST 01:30 ^
  /TR "cmd /c cd /d C:\Users\Thusala\Desktop\clinic-management-system && npm run backup >> backups\backup.log 2>&1"
```

**Run the restore drill before going live** (and periodically after). Restore into a
*throwaway* DB so live data is never at risk:

```powershell
# (PostgreSQL bin on PATH)
createdb suwa_restore_test
npm run restore -- --file backups\suwa-<ts>.dump.enc --database-url postgresql://suwa:<pw>@localhost:5432/suwa_restore_test --yes
# spot-check row counts / a few patients + bills, then:
dropdb suwa_restore_test
```

`npm run restore` requires `--yes` (it is destructive). A real restore into the live DB:
`npm run restore -- --file backups\<dump>.dump.enc --yes`, then `npm run db:status`.

---

## 5. Updating the app

```powershell
schtasks /End /TN "Suwa App"     # stop the running server
git pull                          # or copy the new project files over
npm install                       # in case dependencies changed
npm run db:migrate                # apply any new schema changesets
npm run build
schtasks /Run /TN "Suwa App"      # start again
```

Always **back up first** (`npm run backup`) before a migration or update.

---

## 6. Health checks

| Check | Command / action | Expected |
|-------|------------------|----------|
| DB reachable | `psql postgresql://suwa:<pw>@localhost:5432/suwa -c "select 1;"` | `1` |
| Schema current | `npm run db:status` | "up to date" / no pending |
| App responds | open <http://localhost:3000> | redirects to `/login` |
| Login works | sign in as owner | reaches the dashboard |
| Backup runs | `npm run backup` | new `.dump.enc` in `backups\` |
| Restore works | the §4 drill | row counts match source |

---

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `DATABASE_URL is not set` | `.env` missing or not in the working dir | Create `.env` (§2.3); run from the repo root. |
| `npm run build` hangs/fails connecting | PostgreSQL not running | Start the Postgres service; verify §6 DB check. |
| `Failed to run "pg_dump"… on PATH?` | Postgres client tools not on PATH | Add `…\PostgreSQL\16\bin` to PATH; reopen PowerShell. |
| Backup deleted all dumps | (Fixed in code) invalid `BACKUP_KEEP` | Set `BACKUP_KEEP` to a number, or leave it unset (default 14). |
| Can't decrypt a dump | Wrong/lost `BACKUP_ENCRYPTION_KEY` | Use the exact key the dump was made with — there is no recovery without it. |
| Port 3000 in use | Another process / old instance | `npx next start -p 3001`, or stop the other process. |
| Staff PCs can't reach it | Bound to localhost / firewall | Start with `-H 0.0.0.0`; allow the port in Windows Firewall. |
| `An owner already exists` on seed | Owner already created | Expected — seeding is one-time. Add people via the **Team** page. |
| Restore exits with errors | Genuine restore failure | Read the pg_restore output; ensure the target DB exists and the dump isn't corrupt. |

---

## 8. Disaster recovery (PC lost / rebuilt)

1. Reinstall the prerequisites (§1) on the replacement PC.
2. Recreate the DB + role (§2.2) and `.env` — **with the same `BACKUP_ENCRYPTION_KEY`**.
3. Pull the latest dump from Google Drive and restore it:
   ```powershell
   npm run restore -- --from-remote suwa-<ts>.dump.enc --yes
   ```
4. `npm run db:status` to confirm the schema, `npm install && npm run build`, then start (§3).

Because there's no cloud/provider lock-in, the same encrypted dump also restores into any
managed PostgreSQL when scaling beyond one PC (see `docs/roadmap.md` migration path).

---

## 9. Security checklist

- [ ] Strong DB password; `.env` and `liquibase/liquibase.properties` never committed.
- [ ] Long random `SESSION_SECRET`.
- [ ] `BACKUP_ENCRYPTION_KEY` set **and** stored off the clinic PC.
- [ ] Owner seeded with a real password; no shared accounts — each person invited via **Team**.
- [ ] Nightly backup scheduled **and** the restore drill has been run successfully at least once.
- [ ] Windows Firewall scoped to the local network if staff PCs connect over the LAN.
- [ ] Full-disk encryption (BitLocker) on the clinic PC — it holds clinical + financial data.
