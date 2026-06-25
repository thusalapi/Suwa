import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/auth";
import { getReport } from "@/lib/reports";
import { getClinic } from "@/lib/clinic";
import { ReportDocument } from "@/components/pdf/ReportDocument";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";

/**
 * Branded report PDF. Route Handler (per suwa-backend: files via handlers, not actions).
 * Renders server-side with @react-pdf/renderer from the frozen snapshot + stored data, so the
 * issued document is reproducible. Tenant-scoped; returns 401/404 rather than redirecting.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const report = await getReport(user.clinicId, id);
  if (!report) return new Response("Not found", { status: 404 });

  const clinic = await getClinic(user.clinicId);

  const buffer = await renderToBuffer(
    <ReportDocument
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
      "Content-Disposition": `inline; filename="report-${report.reportNumber}.pdf"`,
    },
  });
}
