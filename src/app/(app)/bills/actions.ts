"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser, requireRole } from "@/lib/auth";
import { billSchema, paymentSchema, cancelBillSchema } from "@/lib/schema/bill";
import { createBill, recordPayment, cancelBill, getBill, BillError } from "@/lib/bills";

export interface BillFormState {
  error?: string;
  detail?: string;
}

export async function createBillAction(_prev: BillFormState, formData: FormData): Promise<BillFormState> {
  const user = await requireUser();

  let items: unknown;
  try {
    items = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { error: "bills.invalidItems" };
  }

  const parsed = billSchema.safeParse({
    patientId: formData.get("patientId"),
    discountRupees: formData.get("discountRupees") ?? 0,
    items,
  });
  if (!parsed.success) {
    return { error: "bills.invalidItems", detail: parsed.error.issues[0]?.message };
  }

  const d = parsed.data;
  let created: { id: string };
  try {
    created = await createBill(user.clinicId, user.id, {
      patientId: d.patientId,
      discount: Math.round(d.discountRupees * 100),
      items: d.items.map((i) => ({
        serviceId: i.serviceId ?? null,
        description: i.description,
        quantity: i.quantity,
        unitPrice: Math.round(i.unitPriceRupees * 100),
      })),
    });
  } catch (e) {
    if (e instanceof BillError) return { error: "bills.saveError", detail: e.message };
    return { error: "bills.saveError" };
  }

  redirect(`/bills/${created.id}`);
}

export interface PaymentFormState {
  error?: string;
  success?: boolean;
}

export async function recordPaymentAction(_prev: PaymentFormState, formData: FormData): Promise<PaymentFormState> {
  const user = await requireUser();

  const billId = String(formData.get("billId") ?? "");
  if (!billId || !(await getBill(user.clinicId, billId))) return { error: "bills.payError" };

  const parsed = paymentSchema.safeParse({
    amountRupees: formData.get("amountRupees"),
    method: formData.get("method"),
  });
  if (!parsed.success) return { error: "bills.payInvalid" };

  try {
    await recordPayment(user.clinicId, user.id, billId, {
      amount: Math.round(parsed.data.amountRupees * 100),
      method: parsed.data.method,
    });
  } catch (e) {
    if (e instanceof BillError && e.code === "exceeds_balance") return { error: "bills.payExceedsBalance" };
    if (e instanceof BillError && e.code === "already_settled") return { error: "bills.paySettled" };
    return { error: "bills.payError" };
  }

  revalidatePath(`/bills/${billId}`);
  return { success: true };
}

export interface CancelBillState {
  error?: string;
  success?: boolean;
}

/**
 * Void a bill. Owner-only: a bill number is a financial record, so cancelling one is not a
 * front-desk correction. Re-checked here rather than relying on the page guard alone.
 */
export async function cancelBillAction(_prev: CancelBillState, formData: FormData): Promise<CancelBillState> {
  const user = await requireRole("owner");

  const parsed = cancelBillSchema.safeParse({
    billId: formData.get("billId"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) return { error: "bills.cancelError" };

  try {
    await cancelBill(user.clinicId, user.id, parsed.data.billId, parsed.data.reason || undefined);
  } catch (e) {
    if (e instanceof BillError && e.code === "has_payments") return { error: "bills.cancelHasPayments" };
    if (e instanceof BillError && e.code === "not_found") return { error: "bills.cancelNotFound" };
    return { error: "bills.cancelError" };
  }

  revalidatePath(`/bills/${parsed.data.billId}`);
  revalidatePath("/bills");
  return { success: true };
}
