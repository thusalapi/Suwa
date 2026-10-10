import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { AuthShell } from "@/components/templates/AuthShell";
import { getT } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";
import { ResetPasswordForm } from "./ResetPasswordForm";
import { PageTitle } from "@/components/atoms/Heading";

/**
 * First-login password reset. Lives OUTSIDE the (app) group so the layout's
 * `mustReset → /reset-password` redirect can't loop. Users who don't need a reset are sent on.
 */
export default async function ResetPasswordPage() {
  const user = await requireUser();
  if (!user.mustReset) redirect("/dashboard");

  const locale = DEFAULT_LOCALE;
  const t = getT(locale);

  return (
    <AuthShell locale={locale}>
      <PageTitle className="mb-1">{t("reset.title")}</PageTitle>
      <p className="mb-4 text-sm text-muted">{t("reset.subtitle")}</p>
      <ResetPasswordForm locale={locale} />
    </AuthShell>
  );
}
