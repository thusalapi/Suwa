"use server";

import { revalidatePath } from "next/cache";
import { requireRole, hashPassword } from "@/lib/auth";
import { inviteUserSchema } from "@/lib/schema/user";
import { createInvitedUser, emailExists } from "@/lib/users";

/** Result surfaced back to the invite form via `useActionState`. Messages are i18n keys. */
export interface InviteState {
  error?: string;
  fieldErrors?: { name?: string; email?: string; role?: string; password?: string };
  success?: boolean;
}

export async function inviteUserAction(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  // Only the owner can create accounts; re-checked server-side, not just in middleware.
  const owner = await requireRole("owner");

  const parsed = inviteUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const f = parsed.error.flatten().fieldErrors;
    return {
      fieldErrors: {
        name: f.name?.length ? "team.nameRequired" : undefined,
        email: f.email?.length ? "team.emailInvalid" : undefined,
        role: f.role?.length ? "team.roleInvalid" : undefined,
        password: f.password?.length ? "team.passwordTooShort" : undefined,
      },
    };
  }

  const d = parsed.data;
  const email = d.email.toLowerCase();

  if (await emailExists(email)) {
    return { fieldErrors: { email: "team.emailTaken" } };
  }

  try {
    const passwordHash = await hashPassword(d.password);
    await createInvitedUser(owner.clinicId, owner.id, {
      name: d.name,
      email,
      role: d.role,
      passwordHash,
    });
  } catch {
    // Includes the unique-email race (constraint is the real guard).
    return { error: "team.saveError" };
  }

  revalidatePath("/team");
  return { success: true };
}
