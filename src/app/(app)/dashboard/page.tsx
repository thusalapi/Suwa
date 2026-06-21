import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";

export default async function DashboardPage() {
  const user = await requireUser();
  const t = getT(DEFAULT_LOCALE);

  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold text-ink">{t("dashboard.title")}</h1>
      <p className="text-sm text-muted">{t("dashboard.welcome", { name: user.name })}</p>
      <p className="pt-6 text-sm text-muted">{t("dashboard.comingSoon")}</p>
    </div>
  );
}
