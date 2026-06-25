"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { templateSchema, type Template } from "@/lib/report-engine";
import {
  createTemplate,
  updateTemplate,
  getTemplate,
  setTemplateActive,
} from "@/lib/report-templates";

/** Result surfaced back to the template editor. `error` is an i18n key; `detail` is raw. */
export interface TemplateFormState {
  error?: string;
  /** Technical validation/parse detail (a JSON path / message — data, not translated copy). */
  detail?: string;
}

type ParseResult =
  | { ok: true; template: Template }
  | { ok: false; state: TemplateFormState };

/** Parse the pasted JSON and validate it against the template schema. */
function parseTemplateJson(raw: FormDataEntryValue | null): ParseResult {
  if (typeof raw !== "string" || raw.trim() === "") {
    return { ok: false, state: { error: "templates.required" } };
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    return { ok: false, state: { error: "templates.invalidJson", detail: e instanceof Error ? e.message : String(e) } };
  }

  const parsed = templateSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const detail = first ? `${first.path.join(".") || "(root)"}: ${first.message}` : undefined;
    return { ok: false, state: { error: "templates.invalidSchema", detail } };
  }

  return { ok: true, template: parsed.data };
}

export async function createTemplateAction(
  _prev: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  const user = await requireRole("owner");

  const res = parseTemplateJson(formData.get("schema"));
  if (!res.ok) return res.state;

  let id: string;
  try {
    id = await createTemplate(user.clinicId, user.id, res.template);
  } catch {
    return { error: "templates.saveError" };
  }

  redirect(`/templates/${id}`);
}

export async function updateTemplateAction(
  _prev: TemplateFormState,
  formData: FormData,
): Promise<TemplateFormState> {
  const user = await requireRole("owner");

  const id = String(formData.get("id") ?? "");
  if (!id || !(await getTemplate(user.clinicId, id))) {
    return { error: "templates.saveError" };
  }

  const res = parseTemplateJson(formData.get("schema"));
  if (!res.ok) return res.state;

  try {
    await updateTemplate(user.clinicId, user.id, id, res.template);
  } catch {
    return { error: "templates.saveError" };
  }

  redirect(`/templates/${id}`);
}

/** Activate / deactivate a template (form action from the list/edit screens). */
export async function toggleTemplateActiveAction(formData: FormData): Promise<void> {
  const user = await requireRole("owner");
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (!id) return;

  await setTemplateActive(user.clinicId, user.id, id, active);
  revalidatePath("/templates");
  revalidatePath(`/templates/${id}`);
}
