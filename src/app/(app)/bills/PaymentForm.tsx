"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Input } from "@/components/atoms/Input";
import { Label } from "@/components/atoms/Label";
import { Button } from "@/components/atoms/Button";
import { Spinner } from "@/components/atoms/Spinner";
import { cn } from "@/lib/utils/cn";
import { getT } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/types";
import { recordPaymentAction, type PaymentFormState } from "./actions";

// Inlined (instead of importing the Zod schema) to keep Zod out of the client bundle.
const METHODS = ["cash", "card", "bank", "other"] as const;

const selectClass = cn(
  "h-9 w-full rounded-md border border-border bg-white px-2 text-sm text-ink",
  "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary",
);

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Spinner label={pendingLabel} /> : null}
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function PaymentForm({
  locale,
  billId,
  maxRupees,
}: {
  locale: Locale;
  billId: string;
  /** Outstanding balance in rupees; caps the amount input as a hint (server enforces it). */
  maxRupees?: number;
}) {
  const t = getT(locale);
  const [state, formAction] = useActionState<PaymentFormState, FormData>(recordPaymentAction, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="billId" value={billId} />

      <div className="space-y-1.5">
        <Label htmlFor="amountRupees">{t("bills.paymentAmount")}</Label>
        <Input
          id="amountRupees"
          name="amountRupees"
          type="number"
          min={0.01}
          max={maxRupees}
          step="0.01"
          className="w-36"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="method">{t("bills.method")}</Label>
        <select id="method" name="method" defaultValue="cash" className={selectClass}>
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {t(`bills.method_${m}`)}
            </option>
          ))}
        </select>
      </div>

      <SubmitButton label={t("bills.recordPayment")} pendingLabel={t("common.saving")} />

      {state.error ? <p role="alert" className="w-full text-sm text-danger">{t(state.error)}</p> : null}
      {state.success ? <p role="status" className="w-full text-sm text-success">{t("bills.paymentRecorded")}</p> : null}
    </form>
  );
}
