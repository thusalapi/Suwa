import { requireRole } from "@/lib/auth";
import { getClinic } from "@/lib/clinic";
import { getT } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";
import { SettingsForm } from "./SettingsForm";

/** Owner-only clinic settings: identity (name/address/phone/logo) + billing defaults. */
export default async function SettingsPage() {
  const user = await requireRole("owner");
  const t = getT(DEFAULT_LOCALE);
  const clinic = await getClinic(user.clinicId);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-ink">{t("settings.title")}</h1>
        <p className="text-sm text-muted">{t("settings.subtitle")}</p>
      </div>

      <SettingsForm
        locale={DEFAULT_LOCALE}
        initial={{
          name: clinic?.name ?? "",
          address: clinic?.address ?? "",
          phone: clinic?.phone ?? "",
          logoUrl: clinic?.logoUrl ?? "",
          currency: clinic?.currency ?? "LKR",
          taxRatePercent: clinic ? clinic.taxRate / 100 : 0,
          showReportQr: clinic?.showReportQr ?? true,
        }}
      />
    </div>
  );
}
