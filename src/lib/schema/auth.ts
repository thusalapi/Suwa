import { z } from "zod";

/** Shared login schema — used by the login Server Action (and re-usable on the client). */
export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
