import { z } from "zod";

/**
 * Shared user schemas. There is no public sign-up: the owner invites staff/doctor with a
 * temporary password (the user is forced to reset it on first login), and invited users set
 * their own password via the reset flow. Owner accounts are seeded by `scripts/seed-owner`,
 * so an invite can only create `staff` or `doctor`.
 */
export const inviteUserSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email(),
  role: z.enum(["staff", "doctor"]),
  password: z.string().min(8).max(200),
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8).max(200),
    confirm: z.string().min(1),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "mismatch" });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
