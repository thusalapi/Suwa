"use server";

import { redirect } from "next/navigation";
import { getCurrentUser, clearSessionCookie } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

/** Clear the session and return to login. Audits the event while the user is still known. */
export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser();
  if (user) {
    await recordAudit({
      clinicId: user.clinicId,
      userId: user.id,
      action: "auth.logout",
      entityType: "user",
      entityId: user.id,
    });
  }
  await clearSessionCookie();
  redirect("/login");
}
