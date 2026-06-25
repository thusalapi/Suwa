import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getTemplate } from "@/lib/report-templates";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { getT } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";
import { TemplateForm } from "../TemplateForm";
import { updateTemplateAction, toggleTemplateActiveAction } from "../actions";

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("owner");
  const { id } = await params;
  const locale = DEFAULT_LOCALE;
  const t = getT(locale);

  const template = await getTemplate(user.clinicId, id);
  if (!template) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link href="/templates" className="text-sm text-muted hover:text-ink">
            ← {t("templates.title")}
          </Link>
          <h1 className="text-xl font-semibold text-ink">{template.name}</h1>
          <div className="flex items-center gap-2 text-sm text-muted">
            <span>v{template.version}</span>
            {template.active ? (
              <Badge tone="success">{t("templates.active")}</Badge>
            ) : (
              <Badge tone="neutral">{t("templates.inactive")}</Badge>
            )}
          </div>
        </div>

        <form action={toggleTemplateActiveAction}>
          <input type="hidden" name="id" value={template.id} />
          <input type="hidden" name="active" value={template.active ? "false" : "true"} />
          <Button type="submit" variant="secondary">
            {template.active ? t("templates.deactivate") : t("templates.activate")}
          </Button>
        </form>
      </div>

      <p className="text-sm text-muted">{t("templates.editHint")}</p>

      <TemplateForm
        locale={locale}
        action={updateTemplateAction}
        templateId={template.id}
        initialJson={JSON.stringify(template.schema, null, 2)}
        submitLabel={t("templates.saveNewVersion")}
      />
    </div>
  );
}
