import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/auth";
import { getRevenueReport, resolveRange } from "@/lib/analytics";
import { getClinic } from "@/lib/clinic";
import { RevenueDocument } from "@/components/pdf/RevenueDocument";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";

/** Branded revenue-report PDF. Owner-only Route Handler; respects ?from=&to=. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (user.role !== "owner") return new Response("Forbidden", { status: 403 });

  const url = new URL(req.url);
  const range = resolveRange(url.searchParams.get("from") ?? undefined, url.searchParams.get("to") ?? undefined);
  const report = await getRevenueReport(user.clinicId, range);
  const clinic = await getClinic(user.clinicId);

  const buffer = await renderToBuffer(
    <RevenueDocument
      locale={DEFAULT_LOCALE}
      clinic={{
        name: clinic?.name ?? "",
        address: clinic?.address ?? null,
        phone: clinic?.phone ?? null,
        logoUrl: clinic?.logoUrl ?? null,
      }}
      report={report}
    />,
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="revenue-${range.from}_${range.to}.pdf"`,
    },
  });
}
