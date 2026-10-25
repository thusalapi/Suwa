import "server-only";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { loginAttempts } from "@/lib/db/schema";

/**
 * Sign-in rate limiting, stored in the database so it holds across app instances and restarts.
 *
 * Within a rolling WINDOW, sign-in is refused when there have been MAX_PER_EMAIL failed attempts
 * for one email since its last successful sign-in, or MAX_PER_IP failed attempts from one client
 * IP. Refused attempts are not recorded, so waiting out the window always unlocks.
 */
export const LOGIN_WINDOW_MINUTES = 15;
export const MAX_FAILURES_PER_EMAIL = 5;
export const MAX_FAILURES_PER_IP = 20;

/** Pure policy: is sign-in blocked given recent failure counts? */
export function isBlocked(failuresForEmail: number, failuresForIp: number): boolean {
  return failuresForEmail >= MAX_FAILURES_PER_EMAIL || failuresForIp >= MAX_FAILURES_PER_IP;
}

/** The client IP from proxy headers (Tailscale serve / load balancer), else "unknown". */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

const windowStart = () => new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60 * 1000);

/** True when this email or IP has had too many recent failed sign-ins. */
export async function loginBlocked(email: string, ip: string): Promise<boolean> {
  const since = windowStart();

  // Email failures only count after the email's latest success in the window.
  const [lastSuccess] = await db
    .select({ at: sql<Date | null>`max(${loginAttempts.createdAt})` })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.email, email), eq(loginAttempts.succeeded, true), gt(loginAttempts.createdAt, since)));
  const emailSince = lastSuccess?.at ? new Date(lastSuccess.at) : since;

  const [byEmail] = await db
    .select({ n: sql<string>`count(*)` })
    .from(loginAttempts)
    .where(
      and(eq(loginAttempts.email, email), eq(loginAttempts.succeeded, false), gt(loginAttempts.createdAt, emailSince)),
    );
  const [byIp] = await db
    .select({ n: sql<string>`count(*)` })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.ip, ip), eq(loginAttempts.succeeded, false), gt(loginAttempts.createdAt, since)));

  return isBlocked(Number(byEmail?.n ?? 0), Number(byIp?.n ?? 0));
}

/** Record an attempt; occasionally prunes rows older than a day so the table stays small. */
export async function recordLoginAttempt(email: string, ip: string, succeeded: boolean): Promise<void> {
  await db.insert(loginAttempts).values({ email, ip, succeeded });
  if (Math.random() < 0.05) {
    await db.delete(loginAttempts).where(lt(loginAttempts.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)));
  }
}
