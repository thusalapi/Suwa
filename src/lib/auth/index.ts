import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, type UserRole } from "@/lib/db/schema";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "./session";

export type { SessionPayload } from "./session";
export { hashPassword, verifyPassword } from "./password";

/** Read + verify the session from the cookie (no DB hit). */
export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

/** Issue a session cookie for a freshly authenticated user. */
export async function setSessionCookie(user: { id: string; clinicId: string; role: UserRole }): Promise<void> {
  const token = await createSessionToken(user);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export interface CurrentUser {
  id: string;
  clinicId: string;
  name: string;
  email: string;
  role: UserRole;
  /** True until an invited user sets their own password on first login. */
  mustReset: boolean;
}

/** Load the authenticated user from the DB, or null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session) return null;
  const rows = await db
    .select({
      id: users.id,
      clinicId: users.clinicId,
      name: users.name,
      email: users.email,
      role: users.role,
      mustReset: users.mustReset,
    })
    .from(users)
    .where(eq(users.id, session.sub))
    .limit(1);
  return rows[0] ?? null;
}

/** Guard: require any authenticated user. Redirects to /login otherwise. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Guard: require one of the given roles. Re-check this server-side in every mutation. */
export async function requireRole(...roles: UserRole[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/dashboard");
  return user;
}
