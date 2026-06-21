"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Field } from "@/components/atoms/Field";
import { Input } from "@/components/atoms/Input";
import { Button } from "@/components/atoms/Button";
import { Spinner } from "@/components/atoms/Spinner";
import { getT } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/types";
import { loginAction, type LoginState } from "./actions";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? <Spinner label={pendingLabel} /> : null}
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function LoginForm({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const [state, formAction] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <Field
        label={t("auth.email")}
        htmlFor="email"
        error={state.fieldErrors?.email ? t(state.fieldErrors.email) : undefined}
      >
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder={t("auth.emailPlaceholder")}
          invalid={!!state.fieldErrors?.email}
          required
        />
      </Field>
      <Field
        label={t("auth.password")}
        htmlFor="password"
        error={state.fieldErrors?.password ? t(state.fieldErrors.password) : undefined}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder={t("auth.passwordPlaceholder")}
          invalid={!!state.fieldErrors?.password}
          required
        />
      </Field>

      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {t(state.error)}
        </p>
      ) : null}

      <SubmitButton label={t("auth.submit")} pendingLabel={t("auth.signingIn")} />
    </form>
  );
}
