"use server";

import { redirect } from "next/navigation";
import { requireUser, hashPassword } from "@/lib/auth";
import { setUserPassword } from "@/lib/users";
import { resetPasswordSchema } from "@/lib/schema/user";

/** Result surfaced back to the reset form via `useActionState`. Messages are i18n keys. */
export interface ResetState {
  error?: string;
  fieldErrors?: { password?: string; confirm?: string };
}

export async function resetPasswordAction(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  // Must be the authenticated (just-logged-in) user setting their own password.
  const user = await requireUser();

  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) {
    const f = parsed.error.flatten().fieldErrors;
    return {
      fieldErrors: {
        password: f.password?.length ? "reset.passwordTooShort" : undefined,
        confirm: f.confirm?.length ? "reset.mismatch" : undefined,
      },
    };
  }

  try {
    const passwordHash = await hashPassword(parsed.data.password);
    await setUserPassword(user.clinicId, user.id, passwordHash);
  } catch {
    return { error: "reset.saveError" };
  }

  // mustReset is now false; the app layout will let them through.
  redirect("/dashboard");
}
