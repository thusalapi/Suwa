import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";
import { TemplateForm } from "../TemplateForm";
import { createTemplateAction } from "../actions";

/** Starter skeleton shown in the editor for a new template (version is system-managed). */
const STARTER = {
  name: "New Report",
  version: 1,
  sections: [
    { type: "patient_info", fields: ["name", "age", "gender", "ref_doctor"] },
    {
      type: "results_table",
      title: "Results",
      rows: [{ key: "example", test: "Example analyte", unit: "", ref_low: 0, ref_high: 1 }],
    },
    { type: "textarea", key: "comments", label: "Comments" },
    { type: "signature", label: "Verified by" },
  ],
};

export default async function NewTemplatePage() {
  await requireRole("owner");
  const locale = DEFAULT_LOCALE;
  const t = getT(locale);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/templates" className="text-sm text-muted hover:text-ink">
          ← {t("templates.title")}
        </Link>
        <h1 className="text-xl font-semibold text-ink">{t("templates.addTitle")}</h1>
      </div>

      <TemplateForm
        locale={locale}
        action={createTemplateAction}
        initialJson={JSON.stringify(STARTER, null, 2)}
        submitLabel={t("templates.add")}
      />
    </div>
  );
}
