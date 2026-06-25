"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Field } from "@/components/atoms/Field";
import { Input } from "@/components/atoms/Input";
import { Button } from "@/components/atoms/Button";
import { Spinner } from "@/components/atoms/Spinner";
import { getT } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/types";
import type { ServiceFormState } from "./actions";

export interface ServiceFormValues {
  name: string;
  priceRupees: string;
  category: string;
}

export interface ServiceFormProps {
  locale: Locale;
  action: (prev: ServiceFormState, formData: FormData) => Promise<ServiceFormState>;
  serviceId?: string;
  initial?: ServiceFormValues;
  submitLabel: string;
}

const EMPTY: ServiceFormValues = { name: "", priceRupees: "", category: "" };

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Spinner label={pendingLabel} /> : null}
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function ServiceForm({ locale, action, serviceId, initial, submitLabel }: ServiceFormProps) {
  const t = getT(locale);
  const values = initial ?? EMPTY;
  const [state, formAction] = useActionState<ServiceFormState, FormData>(action, {});

  return (
    <form action={formAction} className="max-w-xl space-y-4" noValidate>
      {serviceId ? <input type="hidden" name="id" value={serviceId} /> : null}

      <Field
        label={t("services.name")}
        htmlFor="name"
        error={state.fieldErrors?.name ? t(state.fieldErrors.name) : undefined}
      >
        <Input id="name" name="name" defaultValue={values.name} invalid={!!state.fieldErrors?.name} required />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label={t("services.price")}
          htmlFor="priceRupees"
          hint={t("services.priceHint")}
          error={state.fieldErrors?.priceRupees ? t(state.fieldErrors.priceRupees) : undefined}
        >
          <Input
            id="priceRupees"
            name="priceRupees"
            type="number"
            min={0}
            step="0.01"
            defaultValue={values.priceRupees}
            invalid={!!state.fieldErrors?.priceRupees}
            required
          />
        </Field>

        <Field label={t("services.category")} htmlFor="category">
          <Input id="category" name="category" defaultValue={values.category} />
        </Field>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {t(state.error)}
        </p>
      ) : null}

      <SubmitButton label={submitLabel} pendingLabel={t("common.saving")} />
    </form>
  );
}
