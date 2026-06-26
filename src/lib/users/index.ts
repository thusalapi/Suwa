import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, type UserRole } from "@/lib/db/schema";
import { recordAudit } from "@/lib/audit";

/** A clinic team member as listed on the team screen. */
export interface ClinicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** True while the invited user still has their temporary password. */
  mustReset: boolean;
}

/** List every user in a clinic (tenant-scoped), owner first then by name. */
export async function listClinicUsers(clinicId: string): Promise<ClinicUser[]> {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      mustReset: users.mustReset,
    })
    .from(users)
    .where(eq(users.clinicId, clinicId))
    .orderBy(users.name);
}

/** True if the email is already taken (emails are globally unique in `users`). */
export async function emailExists(email: string): Promise<boolean> {
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  return !!row;
}

export interface CreateInvitedUserInput {
  name: string;
  email: string;
  role: Exclude<UserRole, "owner">;
  passwordHash: string;
}

/**
 * Create an invited staff/doctor account (mustReset = true). The insert + audit row commit
 * in one transaction. Returns the new user id.
 */
export async function createInvitedUser(
  clinicId: string,
  actorUserId: string,
  input: CreateInvitedUserInput,
): Promise<string> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(users)
      .values({
        clinicId,
        name: input.name,
        email: input.email,
        role: input.role,
        passwordHash: input.passwordHash,
        mustReset: true,
      })
      .returning({ id: users.id });

    await recordAudit(
      {
        clinicId,
        userId: actorUserId,
        action: "user.create",
        entityType: "user",
        entityId: row.id,
        metadata: { role: input.role },
      },
      tx,
    );

    return row.id;
  });
}

/**
 * Set a user's password and clear the must-reset flag (first-login reset). Scoped by clinic
 * for tenant isolation. The update + audit row commit together.
 */
export async function setUserPassword(clinicId: string, userId: string, passwordHash: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash, mustReset: false })
      .where(and(eq(users.id, userId), eq(users.clinicId, clinicId)));

    await recordAudit(
      {
        clinicId,
        userId,
        action: "auth.password_reset",
        entityType: "user",
        entityId: userId,
      },
      tx,
    );
  });
}
