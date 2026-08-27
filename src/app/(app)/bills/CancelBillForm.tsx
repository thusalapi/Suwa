"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Input } from "@/components/atoms/Input";
import { Label } from "@/components/atoms/Label";
import { Button } from "@/components/atoms/Button";
import { Spinner } from "@/components/atoms/Spinner";
import { getT } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/types";
import { cancelBillAction, type CancelBillState } from "./actions";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" disabled={pending}>
      {pending ? <Spinner label={pendingLabel} /> : null}
      {pending ? pendingLabel : label}
    </Button>
  );
}

/**
 * Owner-only void control. Deliberately behind a disclosure rather than a bare button: this is
 * irreversible and sits on the same page as the payment form, so it should take a second
 * deliberate action to reach. A `<details>` gives that friction without a modal — keyboard
 * accessible, and no browser dialog to trap an automated test.
 */
export function CancelBillForm({ locale, billId }: { locale: Locale; billId: string }) {
  const t = getT(locale);
  const [state, formAction] = useActionState<CancelBillState, FormData>(cancelBillAction, {});

  if (state.success) {
    return (
      <p role="status" className="text-sm font-medium text-danger">
        {t("bills.cancelled")}
      </p>
    );
  }

  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-medium text-danger hover:underline">{t("bills.cancel")}</summary>

      <form action={formAction} className="mt-3 space-y-3">
        <input type="hidden" name="billId" value={billId} />
        <p className="max-w-prose text-sm text-muted">{t("bills.cancelIntro")}</p>

        <div className="space-y-1">
          <Label htmlFor="reason">{t("bills.cancelReason")}</Label>
          <Input id="reason" name="reason" maxLength={500} className="max-w-md" />
        </div>

        {state.error ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {t(state.error)}
          </p>
        ) : null}

        <SubmitButton label={t("bills.cancelConfirm")} pendingLabel={t("common.saving")} />
      </form>
    </details>
  );
}
