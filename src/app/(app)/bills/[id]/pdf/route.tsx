import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/auth";
import { getBill } from "@/lib/bills";
import { getClinic } from "@/lib/clinic";
import { BillDocument } from "@/components/pdf/BillDocument";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";

/** Branded invoice/receipt PDF. Tenant-scoped Route Handler; returns inline application/pdf. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const bill = await getBill(user.clinicId, id);
  if (!bill) return new Response("Not found", { status: 404 });

  const clinic = await getClinic(user.clinicId);

  const buffer = await renderToBuffer(
    <BillDocument
      locale={DEFAULT_LOCALE}
      clinic={{
        name: clinic?.name ?? "",
        address: clinic?.address ?? null,
        phone: clinic?.phone ?? null,
        logoUrl: clinic?.logoUrl ?? null,
      }}
      bill={bill}
    />,
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="bill-${bill.billNumber}.pdf"`,
    },
  });
}
