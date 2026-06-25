"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Field } from "@/components/atoms/Field";
import { Input } from "@/components/atoms/Input";
import { Label } from "@/components/atoms/Label";
import { Button } from "@/components/atoms/Button";
import { Spinner } from "@/components/atoms/Spinner";
import { cn } from "@/lib/utils/cn";
import { getT } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/types";
import { GENDERS } from "@/lib/schema/patient";
import type { PatientFormState } from "./actions";

export interface PatientFormValues {
  fullName: string;
  phone: string;
  nic: string;
  gender: string;
  dob: string;
  address: string;
  notes: string;
}

export interface PatientFormProps {
  locale: Locale;
  action: (prev: PatientFormState, formData: FormData) => Promise<PatientFormState>;
  /** Present when editing — rendered as a hidden field and used to prefill. */
  patientId?: string;
  initial?: PatientFormValues;
  submitLabel: string;
}

const EMPTY: PatientFormValues = {
  fullName: "",
  phone: "",
  nic: "",
  gender: "",
  dob: "",
  address: "",
  notes: "",
};

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Spinner label={pendingLabel} /> : null}
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function PatientForm({ locale, action, patientId, initial, submitLabel }: PatientFormProps) {
  const t = getT(locale);
  const values = initial ?? EMPTY;
  const [state, formAction] = useActionState<PatientFormState, FormData>(action, {});

  return (
    <form action={formAction} className="max-w-xl space-y-4" noValidate>
      {patientId ? <input type="hidden" name="id" value={patientId} /> : null}

      <Field
        label={t("patients.name")}
        htmlFor="fullName"
        error={state.fieldErrors?.fullName ? t(state.fieldErrors.fullName) : undefined}
      >
        <Input
          id="fullName"
          name="fullName"
          defaultValue={values.fullName}
          invalid={!!state.fieldErrors?.fullName}
          required
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label={t("patients.phone")}
          htmlFor="phone"
          hint={t("patients.phoneHint")}
          error={state.fieldErrors?.phone ? t(state.fieldErrors.phone) : undefined}
        >
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={values.phone}
            invalid={!!state.fieldErrors?.phone}
            required
          />
        </Field>

        <Field label={t("patients.nicOptional")} htmlFor="nic">
          <Input id="nic" name="nic" defaultValue={values.nic} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="gender">{t("patients.gender")}</Label>
          <select
            id="gender"
            name="gender"
            defaultValue={values.gender}
            className={cn(
              "h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-ink",
              "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary",
            )}
          >
            <option value="">{t("patients.genderUnset")}</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {t(`patients.gender_${g}`)}
              </option>
            ))}
          </select>
        </div>

        <Field label={t("patients.dob")} htmlFor="dob">
          <Input id="dob" name="dob" type="date" defaultValue={values.dob} />
        </Field>
      </div>

      <Field label={t("patients.address")} htmlFor="address">
        <Input id="address" name="address" defaultValue={values.address} />
      </Field>

      <Field label={t("patients.notes")} htmlFor="notes">
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={values.notes}
          className={cn(
            "w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-ink",
            "placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary",
          )}
        />
      </Field>

      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {t(state.error)}
        </p>
      ) : null}

      <SubmitButton label={submitLabel} pendingLabel={t("common.saving")} />
    </form>
  );
}
