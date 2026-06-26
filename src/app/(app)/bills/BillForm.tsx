"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Input } from "@/components/atoms/Input";
import { Label } from "@/components/atoms/Label";
import { Button } from "@/components/atoms/Button";
import { Spinner } from "@/components/atoms/Spinner";
import { cn } from "@/lib/utils/cn";
import { getT, formatMoney } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/types";
import { createBillAction, type BillFormState } from "./actions";

export interface CatalogOption {
  id: string;
  name: string;
  defaultPrice: number; // minor units
}

export interface BillFormProps {
  locale: Locale;
  patientId: string;
  /** Clinic tax rate in basis points (e.g. 800 = 8%), for the live preview. */
  taxRate: number;
  services: CatalogOption[];
  submitLabel: string;
}

interface Row {
  key: number;
  serviceId: string;
  description: string;
  quantity: string;
  unitPriceRupees: string;
}

const selectClass = cn(
  "h-9 w-full rounded-md border border-border bg-white px-2 text-sm text-ink",
  "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary",
);

let nextKey = 1;
const blankRow = (): Row => ({ key: nextKey++, serviceId: "", description: "", quantity: "1", unitPriceRupees: "" });

function toMinor(rupees: string): number {
  const n = Number(rupees);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
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

export function BillForm({ locale, patientId, taxRate, services, submitLabel }: BillFormProps) {
  const t = getT(locale);
  const [state, formAction] = useActionState<BillFormState, FormData>(createBillAction, {});
  const [rows, setRows] = useState<Row[]>([blankRow()]);
  const [discount, setDiscount] = useState("0");

  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const onService = (key: number, serviceId: string) => {
    const svc = services.find((s) => s.id === serviceId);
    update(key, svc
      ? { serviceId, description: svc.name, unitPriceRupees: (svc.defaultPrice / 100).toString() }
      : { serviceId: "" });
  };

  const subtotal = rows.reduce((sum, r) => sum + Number(r.quantity || 0) * toMinor(r.unitPriceRupees), 0);
  const discountMinor = Math.min(toMinor(discount), subtotal);
  const taxBase = Math.max(0, subtotal - discountMinor);
  const tax = Math.round((taxBase * taxRate) / 10_000);
  const total = taxBase + tax;

  // Submitted as a JSON blob the server re-validates.
  const itemsJson = JSON.stringify(
    rows.map((r) => ({
      serviceId: r.serviceId || null,
      description: r.description,
      quantity: Number(r.quantity || 0),
      unitPriceRupees: Number(r.unitPriceRupees || 0),
    })),
  );

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="items" value={itemsJson} />

      <div className="overflow-hidden rounded-lg border border-border bg-surface-raised">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="px-3 py-2 font-medium">{t("bills.item")}</th>
              <th className="px-3 py-2 font-medium">{t("bills.description")}</th>
              <th className="px-3 py-2 font-medium">{t("bills.qty")}</th>
              <th className="px-3 py-2 font-medium">{t("bills.unitPrice")}</th>
              <th className="px-3 py-2 font-medium">{t("bills.lineTotal")}</th>
              <th className="px-3 py-2">
                <span className="sr-only">{t("bills.actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-border last:border-0 align-top">
                <td className="px-3 py-2 w-48">
                  <select
                    aria-label={t("bills.item")}
                    className={selectClass}
                    value={r.serviceId}
                    onChange={(e) => onService(r.key, e.target.value)}
                  >
                    <option value="">{t("bills.freeText")}</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <Input
                    aria-label={t("bills.description")}
                    className="h-9"
                    value={r.description}
                    onChange={(e) => update(r.key, { description: e.target.value })}
                  />
                </td>
                <td className="px-3 py-2 w-20">
                  <Input
                    aria-label={t("bills.qty")}
                    type="number"
                    min={1}
                    className="h-9"
                    value={r.quantity}
                    onChange={(e) => update(r.key, { quantity: e.target.value })}
                  />
                </td>
                <td className="px-3 py-2 w-28">
                  <Input
                    aria-label={t("bills.unitPrice")}
                    type="number"
                    min={0}
                    step="0.01"
                    className="h-9"
                    value={r.unitPriceRupees}
                    onChange={(e) => update(r.key, { unitPriceRupees: e.target.value })}
                  />
                </td>
                <td className="px-3 py-2 text-ink">
                  {formatMoney(Number(r.quantity || 0) * toMinor(r.unitPriceRupees), locale)}
                </td>
                <td className="px-3 py-2 text-right">
                  {rows.length > 1 ? (
                    <button
                      type="button"
                      aria-label={t("bills.removeItem")}
                      className="text-muted hover:text-danger"
                      onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                    >
                      ✕
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button type="button" variant="secondary" size="sm" onClick={() => setRows((rs) => [...rs, blankRow()])}>
        {t("bills.addItem")}
      </Button>

      <div className="flex flex-col items-end gap-1 text-sm">
        <div className="flex w-64 items-center justify-between">
          <span className="text-muted">{t("bills.subtotal")}</span>
          <span className="text-ink">{formatMoney(subtotal, locale)}</span>
        </div>
        <div className="flex w-64 items-center justify-between gap-2">
          <Label htmlFor="discountRupees">{t("bills.discount")}</Label>
          <Input
            id="discountRupees"
            name="discountRupees"
            type="number"
            min={0}
            step="0.01"
            className="h-8 w-28 text-right"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
        </div>
        <div className="flex w-64 items-center justify-between">
          <span className="text-muted">{t("bills.tax", { rate: (taxRate / 100).toString() })}</span>
          <span className="text-ink">{formatMoney(tax, locale)}</span>
        </div>
        <div className="flex w-64 items-center justify-between border-t border-border pt-1 font-semibold">
          <span className="text-ink">{t("bills.total")}</span>
          <span className="text-ink">{formatMoney(total, locale)}</span>
        </div>
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
