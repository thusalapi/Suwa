import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { listTemplates } from "@/lib/report-templates";
import { Button } from "@/components/atoms/Button";
import { Badge } from "@/components/atoms/Badge";
import { getT } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";

export default async function TemplatesPage() {
  const user = await requireRole("owner");
  const t = getT(DEFAULT_LOCALE);
  const templates = await listTemplates(user.clinicId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-ink">{t("templates.title")}</h1>
          <p className="text-sm text-muted">{t("templates.subtitle")}</p>
        </div>
        <Link href="/templates/new">
          <Button>{t("templates.add")}</Button>
        </Link>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface-raised px-4 py-8 text-center text-sm text-muted">
          {t("templates.empty")}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface-raised">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-2 font-medium">{t("templates.name")}</th>
                <th className="px-4 py-2 font-medium">{t("templates.version")}</th>
                <th className="px-4 py-2 font-medium">{t("templates.sections")}</th>
                <th className="px-4 py-2 font-medium">{t("templates.status")}</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((tpl) => (
                <tr key={tpl.id} className="border-b border-border last:border-0 hover:bg-surface">
                  <td className="px-4 py-2">
                    <Link href={`/templates/${tpl.id}`} className="font-medium text-primary-dark hover:underline">
                      {tpl.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-muted">v{tpl.version}</td>
                  <td className="px-4 py-2 text-muted">{tpl.sectionCount}</td>
                  <td className="px-4 py-2">
                    {tpl.active ? (
                      <Badge tone="success">{t("templates.active")}</Badge>
                    ) : (
                      <Badge tone="neutral">{t("templates.inactive")}</Badge>
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
