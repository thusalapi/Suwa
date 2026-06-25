import Link from "next/link";
import { Wordmark } from "@/components/atoms/Wordmark";
import { Badge } from "@/components/atoms/Badge";
import { LogoutButton } from "./LogoutButton";
import { getT } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/types";
import type { UserRole } from "@/lib/db/schema";

export interface TopbarProps {
  locale: Locale;
  clinicName: string;
  userName: string;
  role: UserRole;
}

/** Authenticated app header: brand, clinic, current user + role, sign out. Layout only. */
export function Topbar({ locale, clinicName, userName, role }: TopbarProps) {
  const t = getT(locale);
  return (
    <header className="flex items-center justify-between border-b border-border bg-white px-6 py-3">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <Wordmark locale={locale} className="text-lg" />
          <span className="text-sm text-muted">{clinicName}</span>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="text-muted hover:text-ink">
            {t("nav.dashboard")}
          </Link>
          <Link href="/patients" className="text-muted hover:text-ink">
            {t("nav.patients")}
          </Link>
          <Link href="/reports" className="text-muted hover:text-ink">
            {t("nav.reports")}
          </Link>
          <Link href="/bills" className="text-muted hover:text-ink">
            {t("nav.bills")}
          </Link>
          {role === "owner" ? (
            <>
              <Link href="/templates" className="text-muted hover:text-ink">
                {t("nav.templates")}
              </Link>
              <Link href="/services" className="text-muted hover:text-ink">
                {t("nav.services")}
              </Link>
              <Link href="/team" className="text-muted hover:text-ink">
                {t("nav.team")}
              </Link>
              <Link href="/settings" className="text-muted hover:text-ink">
                {t("nav.settings")}
              </Link>
            </>
          ) : null}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-ink">{userName}</span>
        <Badge tone="neutral">{t(`roles.${role}`)}</Badge>
        <LogoutButton label={t("auth.signOut")} />
      </div>
    </header>
  );
}
