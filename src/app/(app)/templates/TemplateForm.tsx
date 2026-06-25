"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/atoms/Button";
import { Spinner } from "@/components/atoms/Spinner";
import { Label } from "@/components/atoms/Label";
import { cn } from "@/lib/utils/cn";
import { getT } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/types";
import type { TemplateFormState } from "./actions";

export interface TemplateFormProps {
  locale: Locale;
  action: (prev: TemplateFormState, formData: FormData) => Promise<TemplateFormState>;
  templateId?: string;
  /** Pretty-printed JSON to prefill the editor (stored schema, or a starter skeleton). */
  initialJson: string;
  submitLabel: string;
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Spinner label={pendingLabel} /> : null}
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function TemplateForm({ locale, action, templateId, initialJson, submitLabel }: TemplateFormProps) {
  const t = getT(locale);
  const [state, formAction] = useActionState<TemplateFormState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-4">
      {templateId ? <input type="hidden" name="id" value={templateId} /> : null}

      <div className="space-y-1.5">
        <Label htmlFor="schema">{t("templates.schemaLabel")}</Label>
        <p className="text-sm text-muted">{t("templates.schemaHint")}</p>
        <textarea
          id="schema"
          name="schema"
          defaultValue={initialJson}
          spellCheck={false}
          rows={24}
          className={cn(
            "w-full rounded-md border border-border bg-white px-3 py-2 font-mono text-xs text-ink",
            "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary",
          )}
        />
      </div>

      {state.error ? (
        <div role="alert" className="space-y-1 rounded-md border border-danger/30 bg-danger/10 p-3">
          <p className="text-sm font-medium text-danger">{t(state.error)}</p>
          {state.detail ? <p className="font-mono text-xs text-danger">{state.detail}</p> : null}
        </div>
      ) : null}

      <SubmitButton label={submitLabel} pendingLabel={t("common.saving")} />
    </form>
  );
}
