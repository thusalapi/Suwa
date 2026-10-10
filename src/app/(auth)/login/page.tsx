import { AuthShell } from "@/components/templates/AuthShell";
import { getT } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";
import { LoginForm } from "./LoginForm";
import { PageTitle } from "@/components/atoms/Heading";

export default function LoginPage() {
  // Locale will come from a cookie/setting once locale resolution lands.
  const locale = DEFAULT_LOCALE;
  const t = getT(locale);

  return (
    <AuthShell locale={locale}>
      <PageTitle className="mb-4">{t("auth.loginTitle")}</PageTitle>
      <LoginForm locale={locale} />
    </AuthShell>
  );
}
