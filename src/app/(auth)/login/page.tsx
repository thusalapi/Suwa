import { AuthShell } from "@/components/templates/AuthShell";
import { Field } from "@/components/atoms/Field";
import { Input } from "@/components/atoms/Input";
import { Button } from "@/components/atoms/Button";
import { getT } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";

export default function LoginPage() {
  // Locale will come from a cookie/setting once locale resolution lands.
  const locale = DEFAULT_LOCALE;
  const t = getT(locale);

  return (
    <AuthShell locale={locale}>
      <h1 className="mb-4 text-lg font-semibold text-ink">{t("auth.loginTitle")}</h1>
      {/* TODO(auth stage): wire to the login Server Action (verify hash → session cookie). */}
      <form className="space-y-4">
        <Field label={t("auth.email")} htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="username" placeholder={t("auth.emailPlaceholder")} />
        </Field>
        <Field label={t("auth.password")} htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder={t("auth.passwordPlaceholder")}
          />
        </Field>
        <Button type="submit" className="w-full" disabled>
          {t("auth.submit")}
        </Button>
      </form>
    </AuthShell>
  );
}
