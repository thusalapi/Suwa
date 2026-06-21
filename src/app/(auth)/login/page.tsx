import { AuthShell } from "@/components/templates/AuthShell";
import { getT } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  // Locale will come from a cookie/setting once locale resolution lands.
  const locale = DEFAULT_LOCALE;
  const t = getT(locale);

  return (
    <AuthShell locale={locale}>
      <h1 className="mb-4 text-lg font-semibold text-ink">{t("auth.loginTitle")}</h1>
      <LoginForm locale={locale} />
    </AuthShell>
  );
}
