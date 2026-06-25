/**
 * At-rest encryption for database dumps (AES-256-GCM, streaming).
 *
 * Node-only utility — NOT a Next "server-only" module: it's invoked by the standalone
 * `scripts/backup.ts` / `scripts/restore.ts` jobs (run via tsx, outside the Next runtime),
 * so it must not import server-only. The key is derived from BACKUP_ENCRYPTION_KEY via scrypt
 * with a per-file random salt.
 *
 * File layout: [salt:16][iv:12][ciphertext...][authTag:16]
 */
import { createReadStream, createWriteStream } from "node:fs";
import { open, stat, writeFile } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;
const HEADER_LEN = SALT_LEN + IV_LEN;

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, KEY_LEN);
}

async function readBytes(filePath: string, position: number, length: number): Promise<Buffer> {
  const fh = await open(filePath, "r");
  try {
    const buf = Buffer.alloc(length);
    await fh.read(buf, 0, length, position);
    return buf;
  } finally {
    await fh.close();
  }
}

/** Encrypt `srcPath` → `destPath`. Streams, so large dumps don't load into memory. */
export async function encryptFile(srcPath: string, destPath: string, passphrase: string): Promise<void> {
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = deriveKey(passphrase, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const out = createWriteStream(destPath);
  out.write(salt);
  out.write(iv);

  // end:false leaves `out` open so we can append the auth tag after the cipher flushes.
  await pipeline(createReadStream(srcPath), cipher, out, { end: false });

  const tag = cipher.getAuthTag();
  await new Promise<void>((resolve, reject) => {
    out.end(tag, (err?: Error | null) => (err ? reject(err) : resolve()));
  });
}

/** Decrypt `srcPath` → `destPath`, verifying the GCM auth tag (throws if tampered/wrong key). */
export async function decryptFile(srcPath: string, destPath: string, passphrase: string): Promise<void> {
  const { size } = await stat(srcPath);
  if (size < HEADER_LEN + TAG_LEN) {
    throw new Error("Encrypted file is too small or corrupt.");
  }

  const header = await readBytes(srcPath, 0, HEADER_LEN);
  const salt = header.subarray(0, SALT_LEN);
  const iv = header.subarray(SALT_LEN, HEADER_LEN);
  const tag = await readBytes(srcPath, size - TAG_LEN, TAG_LEN);

  const key = deriveKey(passphrase, salt);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  // No ciphertext (empty source): just produce an empty file.
  if (size === HEADER_LEN + TAG_LEN) {
    await writeFile(destPath, Buffer.alloc(0));
    return;
  }

  await pipeline(
    createReadStream(srcPath, { start: HEADER_LEN, end: size - TAG_LEN - 1 }), // end is inclusive
    decipher,
    createWriteStream(destPath),
  );
}
