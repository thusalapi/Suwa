import { z } from "zod";

/**
 * Shared clinic-settings schema — used by the settings Server Action (and re-usable on the
 * client). Tax is entered as a percentage in the UI; the action converts it to basis points
 * (the DB column) so money math stays integer. Currency is a 3-letter code (uppercased in
 * the action before storage).
 */
export const clinicSettingsSchema = z.object({
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().max(500).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  logoUrl: z.string().trim().max(500).optional().default(""),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/),
  taxRatePercent: z.coerce.number().min(0).max(100),
});

export type ClinicSettingsInput = z.infer<typeof clinicSettingsSchema>;
