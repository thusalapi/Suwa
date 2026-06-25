import { z } from "zod";

/**
 * Shared service-catalog schema. Price is entered in rupees (major units) in the UI and
 * converted to integer minor units (cents) in the action — money is always stored as integers.
 */
export const serviceSchema = z.object({
  name: z.string().trim().min(1).max(200),
  priceRupees: z.coerce.number().min(0).max(100_000_000),
  category: z.string().trim().max(100).optional().default(""),
});

export type ServiceInput = z.infer<typeof serviceSchema>;
