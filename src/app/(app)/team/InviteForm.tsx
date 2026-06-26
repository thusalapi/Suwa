"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Field } from "@/components/atoms/Field";
import { Input } from "@/components/atoms/Input";
import { Label } from "@/components/atoms/Label";
import { Button } from "@/components/atoms/Button";
import { Spinner } from "@/components/atoms/Spinner";
import { cn } from "@/lib/utils/cn";
import { getT } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/types";
import { inviteUserAction, type InviteState } from "./actions";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Spinner label={pendingLabel} /> : null}
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function InviteForm({ locale }: { locale: Locale }) {
  const t = getT(locale);
  const [state, formAction] = useActionState<InviteState, FormData>(inviteUserAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the fields after a successful invite so the next one starts blank.
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="max-w-xl space-y-4" noValidate>
      <Field
        label={t("team.name")}
        htmlFor="name"
        error={state.fieldErrors?.name ? t(state.fieldErrors.name) : undefined}
      >
        <Input id="name" name="name" invalid={!!state.fieldErrors?.name} required />
      </Field>

      <Field
        label={t("team.email")}
        htmlFor="email"
        error={state.fieldErrors?.email ? t(state.fieldErrors.email) : undefined}
      >
        <Input id="email" name="email" type="email" autoComplete="off" invalid={!!state.fieldErrors?.email} required />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="role">{t("team.role")}</Label>
          <select
            id="role"
            name="role"
            defaultValue="staff"
            className={cn(
              "h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-ink",
              "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary",
            )}
          >
            <option value="staff">{t("roles.staff")}</option>
            <option value="doctor">{t("roles.doctor")}</option>
          </select>
        </div>

        <Field
          label={t("team.tempPassword")}
          htmlFor="password"
          hint={t("team.tempPasswordHint")}
          error={state.fieldErrors?.password ? t(state.fieldErrors.password) : undefined}
        >
          <Input
            id="password"
            name="password"
            type="text"
            autoComplete="off"
            invalid={!!state.fieldErrors?.password}
            required
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
          {t("team.invited")}
        </p>
      ) : null}

      <SubmitButton label={t("team.invite")} pendingLabel={t("team.inviting")} />
    </form>
  );
}
