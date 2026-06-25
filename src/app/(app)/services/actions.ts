"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { serviceSchema } from "@/lib/schema/service";
import { createService, updateService, getService, setServiceActive } from "@/lib/catalog";

/** Result surfaced back to the service form via `useActionState`. Messages are i18n keys. */
export interface ServiceFormState {
  error?: string;
  fieldErrors?: { name?: string; priceRupees?: string };
}

function parse(formData: FormData) {
  return serviceSchema.safeParse({
    name: formData.get("name"),
    priceRupees: formData.get("priceRupees"),
    category: formData.get("category") ?? "",
  });
}

function fieldErrorsFrom(parsed: ReturnType<typeof parse>): ServiceFormState["fieldErrors"] {
  if (parsed.success) return undefined;
  const f = parsed.error.flatten().fieldErrors;
  return {
    name: f.name?.length ? "services.nameRequired" : undefined,
    priceRupees: f.priceRupees?.length ? "services.priceInvalid" : undefined,
  };
}

export async function createServiceAction(
  _prev: ServiceFormState,
  formData: FormData,
): Promise<ServiceFormState> {
  const user = await requireRole("owner");

  const parsed = parse(formData);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed) };

  try {
    await createService(user.clinicId, user.id, {
      name: parsed.data.name,
      defaultPrice: Math.round(parsed.data.priceRupees * 100), // rupees → minor units
      category: parsed.data.category,
    });
  } catch {
    return { error: "services.saveError" };
  }

  redirect("/services");
}

export async function updateServiceAction(
  _prev: ServiceFormState,
  formData: FormData,
): Promise<ServiceFormState> {
  const user = await requireRole("owner");

  const id = String(formData.get("id") ?? "");
  if (!id || !(await getService(user.clinicId, id))) return { error: "services.saveError" };

  const parsed = parse(formData);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed) };

  try {
    await updateService(user.clinicId, user.id, id, {
      name: parsed.data.name,
      defaultPrice: Math.round(parsed.data.priceRupees * 100),
      category: parsed.data.category,
    });
  } catch {
    return { error: "services.saveError" };
  }

  redirect("/services");
}

/** Activate / deactivate a service (form action from the list/edit screens). */
export async function toggleServiceActiveAction(formData: FormData): Promise<void> {
  const user = await requireRole("owner");
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (!id) return;

  await setServiceActive(user.clinicId, user.id, id, active);
  revalidatePath("/services");
  revalidatePath(`/services/${id}`);
}
