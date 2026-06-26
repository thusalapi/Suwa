/**
 * Nightly backup job: `pg_dump` → encrypt at rest → optional off-site copy to Google Drive
 * (via rclone). Plus the restore path used by the recovery drill.
 *
 * Node-only (shells out to `pg_dump`/`pg_restore`/`rclone`). NOT a Next "server-only" module:
 * it's driven by `scripts/backup.ts` / `scripts/restore.ts` run via tsx, outside Next. It
 * never imports the app's DB client; it talks to Postgres through the dump tools using
 * DATABASE_URL directly, so it stays provider-agnostic (see docs/roadmap.md migration path).
 */
import { spawn } from "node:child_process";
import { mkdir, readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { encryptFile, decryptFile } from "./crypto";

export interface BackupConfig {
  databaseUrl: string;
  /** Passphrase for at-rest encryption (BACKUP_ENCRYPTION_KEY). */
  encryptionKey: string;
  /** Local directory for encrypted dumps. */
  backupDir: string;
  /** rclone remote for off-site copies, e.g. "gdrive:suwa-backups". Undefined = local only. */
  rcloneRemote?: string;
  /** How many local encrypted dumps to keep (older ones pruned). 0 = keep all. */
  keep: number;
}

/** Resolve config from the environment (call AFTER loading .env). Fails fast on missing keys. */
export function resolveBackupConfig(env: NodeJS.ProcessEnv = process.env): BackupConfig {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set — configure .env first.");

  const encryptionKey = env.BACKUP_ENCRYPTION_KEY;
  if (!encryptionKey || encryptionKey.length < 16) {
    throw new Error("BACKUP_ENCRYPTION_KEY is not set (or shorter than 16 chars) — set it in .env.");
  }

  // A non-numeric BACKUP_KEEP must NOT become NaN: pruneLocal would then slice(NaN)→slice(0)
  // and delete every local dump (including the one just written). Fall back to the default.
  const keepRaw = Number(env.BACKUP_KEEP ?? "14");
  const keep = Number.isFinite(keepRaw) ? keepRaw : 14;

  return {
    databaseUrl,
    encryptionKey,
    backupDir: env.BACKUP_DIR || "backups",
    rcloneRemote: env.BACKUP_RCLONE_REMOTE || undefined,
    keep,
  };
}

/** Run an external command, inheriting stdio; rejects with a clear message if it's missing. */
function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit" });
    child.on("error", (err) =>
      reject(new Error(`Failed to run "${cmd}": ${err.message}. Is it installed and on PATH?`)),
    );
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`"${cmd}" exited with code ${code}.`))));
  });
}

/** Filesystem-safe UTC timestamp, e.g. 2026-06-25_20-30-00. */
function stamp(d = new Date()): string {
  return d.toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
}

export interface BackupResult {
  /** Path to the encrypted dump on disk. */
  dumpFile: string;
  /** Whether it was also copied off-site via rclone. */
  uploaded: boolean;
}

/** Create one encrypted backup (and copy off-site if a remote is configured). */
export async function createBackup(config: BackupConfig = resolveBackupConfig()): Promise<BackupResult> {
  await mkdir(config.backupDir, { recursive: true });

  const base = `suwa-${stamp()}`;
  const rawPath = path.join(config.backupDir, `${base}.dump`);
  const encPath = path.join(config.backupDir, `${base}.dump.enc`);

  // 1) pg_dump in custom format (compressed, restorable with pg_restore).
  await run("pg_dump", [config.databaseUrl, "-Fc", "-f", rawPath]);

  // 2) Encrypt at rest, then remove the plaintext dump.
  try {
    await encryptFile(rawPath, encPath, config.encryptionKey);
  } finally {
    await unlink(rawPath).catch(() => {});
  }

  // 3) Off-site copy to Google Drive (if configured).
  let uploaded = false;
  if (config.rcloneRemote) {
    await run("rclone", ["copy", encPath, config.rcloneRemote]);
    uploaded = true;
  }

  // 4) Prune old local dumps.
  await pruneLocal(config);

  return { dumpFile: encPath, uploaded };
}

/** Keep only the newest `config.keep` local encrypted dumps. */
async function pruneLocal(config: BackupConfig): Promise<void> {
  if (!Number.isFinite(config.keep) || config.keep <= 0) return; // 0/invalid = keep all
  const dumps = (await readdir(config.backupDir))
    .filter((f) => f.endsWith(".dump.enc"))
    .sort()
    .reverse(); // names are timestamped, so lexical desc = newest first
  for (const f of dumps.slice(config.keep)) {
    await unlink(path.join(config.backupDir, f)).catch(() => {});
  }
}

/** Pull one encrypted dump from the rclone remote into `destDir`; returns the local path. */
export async function downloadFromRemote(
  config: BackupConfig,
  remoteFileName: string,
  destDir: string,
): Promise<string> {
  if (!config.rcloneRemote) throw new Error("BACKUP_RCLONE_REMOTE is not configured.");
  await mkdir(destDir, { recursive: true });
  await run("rclone", ["copy", `${config.rcloneRemote}/${remoteFileName}`, destDir]);
  return path.join(destDir, remoteFileName);
}

export interface RestoreOptions {
  /** Local path to an encrypted dump (`*.dump.enc`). */
  encryptedPath: string;
  /** Target connection string; defaults to config.databaseUrl. Override to restore elsewhere. */
  databaseUrl?: string;
}

/**
 * Restore an encrypted dump into the target database. DESTRUCTIVE: `--clean --if-exists`
 * drops and recreates objects. Decrypts to a temp file, restores, then removes the temp.
 */
export async function restoreBackup(opts: RestoreOptions, config: BackupConfig = resolveBackupConfig()): Promise<void> {
  const target = opts.databaseUrl ?? config.databaseUrl;
  const tmp = `${opts.encryptedPath.replace(/\.enc$/, "")}.restore-${Date.now()}`;

  await decryptFile(opts.encryptedPath, tmp, config.encryptionKey);
  try {
    await run("pg_restore", ["--clean", "--if-exists", "--no-owner", "-d", target, tmp]);
  } finally {
    await unlink(tmp).catch(() => {});
  }
}
