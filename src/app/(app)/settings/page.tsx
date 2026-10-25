import { requireRole } from "@/lib/auth";
import { getClinic } from "@/lib/clinic";
import { getT } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";
import { SettingsForm } from "./SettingsForm";
import { PageTitle } from "@/components/atoms/Heading";

/** Owner-only clinic settings: identity (name/address/phone/logo) + billing defaults. */
export default async function SettingsPage() {
  const user = await requireRole("owner");
  const t = getT(DEFAULT_LOCALE);
  const clinic = await getClinic(user.clinicId);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <PageTitle>{t("settings.title")}</PageTitle>
        <p className="text-sm text-muted">{t("settings.subtitle")}</p>
      </div>

      <SettingsForm
        locale={DEFAULT_LOCALE}
        initial={{
          name: clinic?.name ?? "",
          address: clinic?.address ?? "",
          phone: clinic?.phone ?? "",
          fax: clinic?.fax ?? "",
          email: clinic?.email ?? "",
          footerNote: clinic?.footerNote ?? "",
          logoUrl: clinic?.logoUrl ?? "",
          currency: clinic?.currency ?? "LKR",
          taxRatePercent: clinic ? clinic.taxRate / 100 : 0,
          showReportQr: clinic?.showReportQr ?? true,
        }}
      />
    </div>
  );
}
