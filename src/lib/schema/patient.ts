import { z } from "zod";

/**
 * Shared patient schema (create + edit). Phone is the lookup key and is REQUIRED; NIC and the
 * rest are optional metadata. Empty strings are allowed for optional fields and normalized to
 * NULL in the service layer.
 */
export const GENDERS = ["male", "female", "other"] as const;
export type Gender = (typeof GENDERS)[number];

const optionalText = (max: number) => z.string().trim().max(max).optional().default("");

export const patientSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  phone: z
    .string()
    .trim()
    .min(7)
    .max(20)
    .regex(/^[0-9+\-\s]+$/), // digits, spaces, +, -
  nic: optionalText(20),
  gender: z.enum(GENDERS).or(z.literal("")).default(""),
  dob: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).default(""),
  address: optionalText(500),
  notes: optionalText(2000),
});

export type PatientInput = z.infer<typeof patientSchema>;
