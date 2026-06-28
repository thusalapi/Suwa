"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser, requireRole } from "@/lib/auth";
import { createReport, updateReport, verifyReport, ReportValidationError } from "@/lib/reports";
import type { ReportFormState } from "@/components/forms/ReportFormRenderer";

/** Collect form entries whose name starts with `prefix`, stripping it from the key. */
function collectPrefixed(formData: FormData, prefix: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith(prefix) && typeof value === "string") {
      out[key.slice(prefix.length)] = value;
    }
  }
  return out;
}

export async function createReportAction(_prev: ReportFormState, formData: FormData): Promise<ReportFormState> {
  const user = await requireUser(); // any clinic role may enter reports

  const patientId = String(formData.get("patientId") ?? "");
  const templateId = String(formData.get("templateId") ?? "");
  if (!patientId || !templateId) return { error: "reports.saveError" };

  const input = {
    patientId,
    templateId,
    patientInfo: collectPrefixed(formData, "pi."),
    results: collectPrefixed(formData, "res."),
    values: { ...collectPrefixed(formData, "fld."), ...collectPrefixed(formData, "txt.") },
  };

  let created: { id: string };
  try {
    created = await createReport(user.clinicId, user.id, input);
  } catch (e) {
    if (e instanceof ReportValidationError) return { error: "reports.invalidData", detail: e.message };
    return { error: "reports.saveError" };
  }

  redirect(`/reports/${created.id}`);
}

/**
 * Edit a draft report's data. `id` is bound (server action) by the edit page; the snapshot is
 * never changed (see `updateReport`). Any clinic role may edit a draft, mirroring create.
 */
export async function updateReportAction(
  id: string,
  _prev: ReportFormState,
  formData: FormData,
): Promise<ReportFormState> {
  const user = await requireUser();

  const input = {
    patientId: String(formData.get("patientId") ?? ""),
    templateId: String(formData.get("templateId") ?? ""),
    patientInfo: collectPrefixed(formData, "pi."),
    results: collectPrefixed(formData, "res."),
    values: { ...collectPrefixed(formData, "fld."), ...collectPrefixed(formData, "txt.") },
  };

  try {
    await updateReport(user.clinicId, user.id, id, input);
  } catch (e) {
    if (e instanceof ReportValidationError) return { error: "reports.invalidData", detail: e.message };
    return { error: "reports.saveError" };
  }

  redirect(`/reports/${id}`);
}

/** Doctor/owner sign-off. Verification is required before a report is released. */
export async function verifyReportAction(formData: FormData): Promise<void> {
  const user = await requireRole("doctor", "owner");
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await verifyReport(user.clinicId, user.id, id);
  revalidatePath(`/reports/${id}`);
}
