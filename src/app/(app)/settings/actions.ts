"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { clinicSettingsSchema } from "@/lib/schema/clinic";
import { updateClinicSettings } from "@/lib/clinic";

/** Result surfaced back to the settings form via `useActionState`. Messages are i18n keys. */
export interface SettingsState {
  error?: string;
  fieldErrors?: { name?: string; currency?: string; taxRatePercent?: string };
  success?: boolean;
}

export async function updateSettingsAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  // Re-check role server-side: the middleware gate is necessary but not sufficient.
  const user = await requireRole("owner");

  const parsed = clinicSettingsSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address"),
    phone: formData.get("phone"),
    logoUrl: formData.get("logoUrl"),
    currency: formData.get("currency"),
    taxRatePercent: formData.get("taxRatePercent"),
    showReportQr: formData.get("showReportQr"),
  });

  if (!parsed.success) {
    const f = parsed.error.flatten().fieldErrors;
    return {
      fieldErrors: {
        name: f.name?.length ? "settings.nameRequired" : undefined,
        currency: f.currency?.length ? "settings.currencyInvalid" : undefined,
        taxRatePercent: f.taxRatePercent?.length ? "settings.taxRateInvalid" : undefined,
      },
    };
  }

  const d = parsed.data;
  try {
    await updateClinicSettings(user.clinicId, user.id, {
      name: d.name,
      address: d.address,
      phone: d.phone,
      logoUrl: d.logoUrl,
      currency: d.currency.toUpperCase(),
      taxRate: Math.round(d.taxRatePercent * 100), // percentage → basis points
      showReportQr: d.showReportQr,
    });
  } catch {
    return { error: "settings.saveError" };
  }

  revalidatePath("/settings");
  revalidatePath("/", "layout"); // clinic name shown in the Topbar
  return { success: true };
}
