# Backups & restore

Clinical and financial data lives only on the clinic PC, so a tested nightly backup is a
**non-negotiable** (see `docs/roadmap.md`). The job runs `pg_dump`, encrypts the dump at
rest (AES-256-GCM), and — if configured — copies it off-site to Google Drive via `rclone`.

> A backup you have never restored is not a backup. Do the **restore drill** below before
> relying on this in production.

## How it works

```
pg_dump -Fc  →  AES-256-GCM encrypt  →  backups/suwa-<timestamp>.dump.enc  →  rclone copy → Google Drive
```

- The plaintext dump is deleted immediately after encryption; only the `.dump.enc` remains.
- Old local dumps are pruned to the newest `BACKUP_KEEP` (default 14).
- Code lives in `src/lib/backup/` (`crypto.ts`, `index.ts`); the entry points are
  `scripts/backup.ts` and `scripts/restore.ts`.

## One-time setup (clinic PC)

1. **PostgreSQL client tools** — `pg_dump` and `pg_restore` ship with PostgreSQL; ensure the
   Postgres `bin` directory is on the system `PATH`.
2. **rclone** (only for off-site copies) — install from <https://rclone.org/downloads/>, then
   configure a Google Drive remote:
   ```bash
   rclone config        # create a remote named e.g. "gdrive" of type "drive"
   rclone mkdir gdrive:suwa-backups
   ```
3. **Environment** (`.env`) — set at minimum the encryption key:
   ```ini
   BACKUP_ENCRYPTION_KEY=<long random passphrase, min 16 chars>
   # optional:
   BACKUP_DIR=backups
   BACKUP_RCLONE_REMOTE=gdrive:suwa-backups
   BACKUP_KEEP=14
   ```
   **Keep a copy of `BACKUP_ENCRYPTION_KEY` somewhere off the clinic PC.** Without it the
   dumps cannot be decrypted — losing it loses the backups.

## Run a backup

```bash
npm run backup
```

Writes `backups/suwa-<timestamp>.dump.enc` and uploads it if `BACKUP_RCLONE_REMOTE` is set.
With no remote configured it still produces a local encrypted dump and says so.

## Schedule it nightly (Windows Task Scheduler)

Create a task that runs the backup every night (adjust the path and time). From an
**elevated** PowerShell, e.g. for 1:30 AM daily:

```powershell
schtasks /Create /TN "Suwa Nightly Backup" /SC DAILY /ST 01:30 ^
  /TR "cmd /c cd /d C:\Users\Thusala\Desktop\clinic-management-system && npm run backup >> backups\backup.log 2>&1"
```

Verify / inspect:

```powershell
schtasks /Query /TN "Suwa Nightly Backup" /V /FO LIST
schtasks /Run   /TN "Suwa Nightly Backup"   # run once now to test
```

Check `backups\backup.log` and confirm a new `.dump.enc` appears (and lands in Drive).

## Restore drill (do this before going live)

Restoring is **destructive** — it overwrites the target database — so it requires `--yes`.

```bash
# restore a local dump into DATABASE_URL
npm run restore -- --file backups/suwa-2026-06-25_01-30-00.dump.enc --yes

# or pull the latest off-site dump first, then restore
npm run restore -- --from-remote suwa-2026-06-25_01-30-00.dump.enc --yes
```

Safest drill (no risk to live data) — restore into a **throwaway** database and verify:

```bash
createdb suwa_restore_test
npm run restore -- --file backups/<dump>.dump.enc \
  --database-url postgresql://suwa:<pw>@localhost:5432/suwa_restore_test --yes
# inspect row counts / spot-check a few patients + bills, then:
dropdb suwa_restore_test
```

After a real restore, run `npm run db:status` to confirm the Liquibase schema state.

## Cloud-migration note

The same encrypted dump restores into any managed PostgreSQL: provision the DB, run
`npm run restore -- --file <dump> --database-url <managed-url> --yes`, then replay Liquibase
and repoint `DATABASE_URL`. No Vercel/provider lock-in (see `docs/roadmap.md`).
