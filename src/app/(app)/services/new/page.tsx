import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";
import { ServiceForm } from "../ServiceForm";
import { createServiceAction } from "../actions";

export default async function NewServicePage() {
  await requireRole("owner");
  const locale = DEFAULT_LOCALE;
  const t = getT(locale);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/services" className="text-sm text-muted hover:text-ink">
          ← {t("services.title")}
        </Link>
        <h1 className="text-xl font-semibold text-ink">{t("services.addTitle")}</h1>
      </div>

      <ServiceForm locale={locale} action={createServiceAction} submitLabel={t("services.add")} />
    </div>
  );
}
