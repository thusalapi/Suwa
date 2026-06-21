import type { UserRole } from "@/lib/db/schema";

/**
 * Stateless signed session token (HMAC-SHA256 via Web Crypto, so it verifies in BOTH the
 * Node runtime and edge middleware). The token carries only ids + role; the full user is
 * loaded from the DB when needed. No secrets or PII in the payload.
 */
export const SESSION_COOKIE = "suwa_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8; // 8h

export interface SessionPayload {
  sub: string; // user id
  clinicId: string;
  role: UserRole;
  iat: number; // issued-at (epoch seconds)
  exp: number; // expiry (epoch seconds)
}

const encoder = new TextEncoder();

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET is not set (or too short) — set a long random value in .env.");
  }
  return secret;
}

function b64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array<ArrayBuffer> {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (str.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Build a signed token for a freshly authenticated user. */
export async function createSessionToken(
  user: { id: string; clinicId: string; role: UserRole },
  now = Math.floor(Date.now() / 1000),
): Promise<string> {
  const payload: SessionPayload = {
    sub: user.id,
    clinicId: user.clinicId,
    role: user.role,
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS,
  };
  const body = b64urlEncode(encoder.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(), encoder.encode(body)));
  return `${body}.${b64urlEncode(sig)}`;
}

/** Verify signature + expiry; returns the payload or null. */
export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  try {
    const valid = await crypto.subtle.verify("HMAC", await hmacKey(), b64urlDecode(sig), encoder.encode(body));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
