"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashPassword, verifyPassword, setSessionCookie } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { loginSchema } from "@/lib/schema/auth";

/** Result surfaced back to the login form via `useActionState`. Messages are i18n keys. */
export interface LoginState {
  /** Generic, non-enumerating error key (don't reveal which field was wrong). */
  error?: string;
  fieldErrors?: { email?: string; password?: string };
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    return {
      fieldErrors: {
        email: flat.email?.length ? "auth.invalidEmail" : undefined,
        password: flat.password?.length ? "auth.required" : undefined,
      },
    };
  }

  const { email, password } = parsed.data;

  const rows = await db
    .select({
      id: users.id,
      clinicId: users.clinicId,
      role: users.role,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  const user = rows[0];

  // Constant-ish time: even when the email is unknown, spend hashing time so an attacker
  // can't distinguish "no such user" from "wrong password" by timing.
  if (!user) {
    await hashPassword(password).catch(() => undefined);
    return { error: "auth.invalidCredentials" };
  }

  const ok = await verifyPassword(user.passwordHash, password).catch(() => false);
  if (!ok) {
    return { error: "auth.invalidCredentials" };
  }

  await setSessionCookie({ id: user.id, clinicId: user.clinicId, role: user.role });
  await recordAudit({
    clinicId: user.clinicId,
    userId: user.id,
    action: "auth.login",
    entityType: "user",
    entityId: user.id,
  });

  // redirect throws — must be outside try/catch and after the cookie is set.
  redirect("/dashboard");
}
