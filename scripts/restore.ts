/**
 * Restore drill / disaster recovery. DESTRUCTIVE — overwrites the target database.
 *
 *   # restore a local encrypted dump into DATABASE_URL
 *   npm run restore -- --file backups/suwa-2026-06-25_20-30-00.dump.enc --yes
 *
 *   # pull the latest off-site dump first, then restore
 *   npm run restore -- --from-remote suwa-2026-06-25_20-30-00.dump.enc --yes
 *
 *   # restore into a DIFFERENT database (e.g. a staging/cloud target) without touching prod
 *   npm run restore -- --file <path> --database-url postgresql://… --yes
 *
 * Requires --yes to proceed (guards against accidental overwrite). See docs/backups.md.
 */
import path from "node:path";
import { resolveBackupConfig, restoreBackup, downloadFromRemote } from "../src/lib/backup";

process.loadEnvFile(".env");

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

async function main() {
  const config = resolveBackupConfig();

  const file = arg("--file");
  const remote = arg("--from-remote");
  const databaseUrl = arg("--database-url"); // optional target override

  if (!file && !remote) {
    fail("Provide --file <path> or --from-remote <filename>. See docs/backups.md.");
  }
  if (!hasFlag("--yes")) {
    fail("Refusing to run without --yes — restore OVERWRITES the target database.");
  }

  let encryptedPath = file;
  if (remote) {
    console.log(`Downloading ${remote} from ${config.rcloneRemote} …`);
    encryptedPath = await downloadFromRemote(config, remote, path.join(config.backupDir, "restore"));
  }

  const targetLabel = databaseUrl ? "the override database" : "DATABASE_URL";
  console.log(`Restoring ${encryptedPath} → ${targetLabel} …`);
  await restoreBackup({ encryptedPath: encryptedPath!, databaseUrl }, config);

  console.log("✓ Restore complete. Verify the data, then run `npm run db:status` to confirm the schema.");
}

main().catch((err) => {
  console.error(`✗ Restore failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
