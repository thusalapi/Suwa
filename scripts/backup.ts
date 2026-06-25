/**
 * Nightly backup entry point. Run on the clinic PC (scheduled via Windows Task Scheduler):
 *
 *   npm run backup
 *
 * Produces an encrypted `pg_dump` in BACKUP_DIR and, if BACKUP_RCLONE_REMOTE is set, copies it
 * off-site to Google Drive via rclone. See docs/backups.md for one-time setup + scheduling.
 */
import { createBackup, resolveBackupConfig } from "../src/lib/backup";

// Node 20.12+/24: load .env without a dependency (mirrors scripts/seed-owner.ts).
process.loadEnvFile(".env");

async function main() {
  const config = resolveBackupConfig();
  const target = config.rcloneRemote
    ? `${config.backupDir} and ${config.rcloneRemote}`
    : `${config.backupDir} (local only — BACKUP_RCLONE_REMOTE not set)`;
  console.log(`Backing up database → ${target} …`);

  const result = await createBackup(config);
  console.log(`✓ Backup written: ${result.dumpFile}${result.uploaded ? " (uploaded off-site)" : ""}`);
}

main().catch((err) => {
  console.error(`✗ Backup failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
