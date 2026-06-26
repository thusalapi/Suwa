"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { patientSchema } from "@/lib/schema/patient";
import { createPatient, updatePatient, findByPhone, getPatient } from "@/lib/patients";

/** Result surfaced back to the patient form via `useActionState`. Messages are i18n keys. */
export interface PatientFormState {
  error?: string;
  fieldErrors?: { fullName?: string; phone?: string };
}

function parse(formData: FormData) {
  return patientSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    nic: formData.get("nic") ?? "",
    gender: formData.get("gender") ?? "",
    dob: formData.get("dob") ?? "",
    address: formData.get("address") ?? "",
    notes: formData.get("notes") ?? "",
  });
}

function fieldErrorsFrom(parsed: ReturnType<typeof parse>): PatientFormState["fieldErrors"] {
  if (parsed.success) return undefined;
  const f = parsed.error.flatten().fieldErrors;
  return {
    fullName: f.fullName?.length ? "patients.nameRequired" : undefined,
    phone: f.phone?.length ? "patients.phoneInvalid" : undefined,
  };
}

export async function createPatientAction(_prev: PatientFormState, formData: FormData): Promise<PatientFormState> {
  const user = await requireUser(); // any clinic role may register patients

  const parsed = parse(formData);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed) };

  // Dedupe by phone (the lookup key) before insert; the unique constraint is the real guard.
  if (await findByPhone(user.clinicId, parsed.data.phone)) {
    return { fieldErrors: { phone: "patients.phoneTaken" } };
  }

  let id: string;
  try {
    id = await createPatient(user.clinicId, user.id, parsed.data);
  } catch {
    return { error: "patients.saveError" };
  }

  redirect(`/patients/${id}`);
}

export async function updatePatientAction(_prev: PatientFormState, formData: FormData): Promise<PatientFormState> {
  const user = await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!id || !(await getPatient(user.clinicId, id))) {
    return { error: "patients.saveError" };
  }

  const parsed = parse(formData);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed) };

  if (await findByPhone(user.clinicId, parsed.data.phone, id)) {
    return { fieldErrors: { phone: "patients.phoneTaken" } };
  }

  try {
    await updatePatient(user.clinicId, user.id, id, parsed.data);
  } catch {
    return { error: "patients.saveError" };
  }

  redirect(`/patients/${id}`);
}
