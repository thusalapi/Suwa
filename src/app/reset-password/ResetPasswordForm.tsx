"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Field } from "@/components/atoms/Field";
import { Input } from "@/components/atoms/Input";
import { Button } from "@/components/atoms/Button";
import { Spinner } from "@/components/atoms/Spinner";
import { getT } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/types";
import { resetPasswordAction, type ResetState } from "./actions";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? <Spinner label={pendingLabel} /> : null}
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function ResetPasswordForm({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const [state, formAction] = useActionState<ResetState, FormData>(resetPasswordAction, {});

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <Field
        label={t("reset.newPassword")}
        htmlFor="password"
        hint={t("reset.passwordHint")}
        error={state.fieldErrors?.password ? t(state.fieldErrors.password) : undefined}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          invalid={!!state.fieldErrors?.password}
          required
        />
      </Field>
      <Field
        label={t("reset.confirmPassword")}
        htmlFor="confirm"
        error={state.fieldErrors?.confirm ? t(state.fieldErrors.confirm) : undefined}
      >
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          invalid={!!state.fieldErrors?.confirm}
          required
        />
      </Field>

      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {t(state.error)}
        </p>
      ) : null}

      <SubmitButton label={t("reset.submit")} pendingLabel={t("reset.saving")} />
    </form>
  );
}
