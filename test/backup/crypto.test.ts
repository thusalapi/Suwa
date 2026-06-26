import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { encryptFile, decryptFile } from "@/lib/backup/crypto";

const KEY = "a-sufficiently-long-passphrase-123";
let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "suwa-crypto-"));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function roundTrip(name: string, bytes: Buffer): Promise<Buffer> {
  const src = path.join(dir, `${name}.bin`);
  const enc = path.join(dir, `${name}.enc`);
  const out = path.join(dir, `${name}.out`);
  await writeFile(src, bytes);
  await encryptFile(src, enc, KEY);
  await decryptFile(enc, out, KEY);
  return readFile(out);
}

describe("backup crypto", () => {
  it("round-trips a multi-megabyte payload byte-for-byte", async () => {
    const bytes = randomBytes(2 * 1024 * 1024);
    expect(Buffer.compare(await roundTrip("big", bytes), bytes)).toBe(0);
  });

  it("round-trips an empty file", async () => {
    expect((await roundTrip("empty", Buffer.alloc(0))).length).toBe(0);
  });

  it("round-trips a small payload spanning the header boundary", async () => {
    const bytes = Buffer.from("patients,bills,reports\n");
    expect(Buffer.compare(await roundTrip("small", bytes), bytes)).toBe(0);
  });

  it("rejects the wrong passphrase", async () => {
    const src = path.join(dir, "wk.bin");
    const enc = path.join(dir, "wk.enc");
    await writeFile(src, randomBytes(1024));
    await encryptFile(src, enc, KEY);
    await expect(decryptFile(enc, path.join(dir, "wk.out"), "the-wrong-passphrase")).rejects.toThrow();
  });

  it("rejects a tampered ciphertext", async () => {
    const src = path.join(dir, "t.bin");
    const enc = path.join(dir, "t.enc");
    await writeFile(src, randomBytes(4096));
    await encryptFile(src, enc, KEY);
    const ct = await readFile(enc);
    ct[ct.length - 20] ^= 0xff; // flip a byte inside the ciphertext
    const tampered = path.join(dir, "t-bad.enc");
    await writeFile(tampered, ct);
    await expect(decryptFile(tampered, path.join(dir, "t.out"), KEY)).rejects.toThrow();
  });

  it("rejects a truncated file that is too small to hold the header + tag", async () => {
    const bad = path.join(dir, "short.enc");
    await writeFile(bad, randomBytes(10));
    await expect(decryptFile(bad, path.join(dir, "short.out"), KEY)).rejects.toThrow();
  });
});
