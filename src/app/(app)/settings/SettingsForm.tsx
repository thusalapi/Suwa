"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Field } from "@/components/atoms/Field";
import { Input } from "@/components/atoms/Input";
import { Button } from "@/components/atoms/Button";
import { Spinner } from "@/components/atoms/Spinner";
import { getT } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/types";
import { updateSettingsAction, type SettingsState } from "./actions";

export interface SettingsInitial {
  name: string;
  address: string;
  phone: string;
  logoUrl: string;
  currency: string;
  taxRatePercent: number;
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

export function SettingsForm({ locale, initial }: { locale: Locale; initial: SettingsInitial }) {
  const t = getT(locale);
  const [state, formAction] = useActionState<SettingsState, FormData>(updateSettingsAction, {});

  return (
    <form action={formAction} className="max-w-xl space-y-4" noValidate>
      <Field
        label={t("settings.clinicName")}
        htmlFor="name"
        error={state.fieldErrors?.name ? t(state.fieldErrors.name) : undefined}
      >
        <Input
          id="name"
          name="name"
          defaultValue={initial.name}
          invalid={!!state.fieldErrors?.name}
          required
        />
      </Field>

      <Field label={t("settings.address")} htmlFor="address">
        <Input id="address" name="address" defaultValue={initial.address} />
      </Field>

      <Field label={t("settings.phone")} htmlFor="phone">
        <Input id="phone" name="phone" type="tel" defaultValue={initial.phone} />
      </Field>

      <Field label={t("settings.logoUrl")} htmlFor="logoUrl" hint={t("settings.logoUrlHint")}>
        <Input id="logoUrl" name="logoUrl" defaultValue={initial.logoUrl} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label={t("settings.currency")}
          htmlFor="currency"
          hint={t("settings.currencyHint")}
          error={state.fieldErrors?.currency ? t(state.fieldErrors.currency) : undefined}
        >
          <Input
            id="currency"
            name="currency"
            maxLength={3}
            defaultValue={initial.currency}
            invalid={!!state.fieldErrors?.currency}
            required
          />
        </Field>

        <Field
          label={t("settings.taxRate")}
          htmlFor="taxRatePercent"
          hint={t("settings.taxRateHint")}
          error={state.fieldErrors?.taxRatePercent ? t(state.fieldErrors.taxRatePercent) : undefined}
        >
          <Input
            id="taxRatePercent"
            name="taxRatePercent"
            type="number"
            min={0}
            max={100}
            step="0.01"
            defaultValue={initial.taxRatePercent}
            invalid={!!state.fieldErrors?.taxRatePercent}
          />
        </Field>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {t(state.error)}
        </p>
      ) : null}

      {state.success ? (
        <p role="status" className="text-sm text-success">
          {t("settings.saved")}
        </p>
      ) : null}

      <SubmitButton label={t("settings.save")} pendingLabel={t("settings.saving")} />
    </form>
  );
}
