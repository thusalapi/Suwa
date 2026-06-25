import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { listServices } from "@/lib/catalog";
import { Button } from "@/components/atoms/Button";
import { Badge } from "@/components/atoms/Badge";
import { getT, formatMoney } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";

export default async function ServicesPage() {
  const user = await requireRole("owner");
  const t = getT(DEFAULT_LOCALE);
  const services = await listServices(user.clinicId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-ink">{t("services.title")}</h1>
          <p className="text-sm text-muted">{t("services.subtitle")}</p>
        </div>
        <Link href="/services/new">
          <Button>{t("services.add")}</Button>
        </Link>
      </div>

      {services.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface-raised px-4 py-8 text-center text-sm text-muted">
          {t("services.empty")}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface-raised">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-2 font-medium">{t("services.name")}</th>
                <th className="px-4 py-2 font-medium">{t("services.category")}</th>
                <th className="px-4 py-2 font-medium">{t("services.price")}</th>
                <th className="px-4 py-2 font-medium">{t("services.status")}</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-surface">
                  <td className="px-4 py-2">
                    <Link href={`/services/${s.id}`} className="font-medium text-primary-dark hover:underline">
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-muted">{s.category || "—"}</td>
                  <td className="px-4 py-2 text-ink">{formatMoney(s.defaultPrice, DEFAULT_LOCALE)}</td>
                  <td className="px-4 py-2">
                    {s.active ? (
                      <Badge tone="success">{t("services.active")}</Badge>
                    ) : (
                      <Badge tone="neutral">{t("services.inactive")}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
