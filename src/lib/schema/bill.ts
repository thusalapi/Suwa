import { z } from "zod";

/**
 * Shared billing schemas. Money is entered in rupees (major units) and converted to integer
 * minor units in the action. Each line snapshots its description + unit price so later catalog
 * edits never change an issued bill.
 */
export const billItemSchema = z.object({
  serviceId: z.string().uuid().nullable().optional(),
  description: z.string().trim().min(1).max(300),
  quantity: z.coerce.number().int().min(1).max(100_000),
  unitPriceRupees: z.coerce.number().min(0).max(100_000_000),
});

export const billSchema = z.object({
  patientId: z.string().uuid(),
  discountRupees: z.coerce.number().min(0).max(100_000_000).default(0),
  items: z.array(billItemSchema).min(1),
});

export type BillInput = z.infer<typeof billSchema>;

export const PAYMENT_METHODS = ["cash", "card", "bank", "other"] as const;

export const paymentSchema = z.object({
  amountRupees: z.coerce.number().min(0.01).max(100_000_000),
  method: z.enum(PAYMENT_METHODS),
});

export type PaymentInput = z.infer<typeof paymentSchema>;
