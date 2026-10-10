import { Wordmark } from "@/components/atoms/Wordmark";
import { Badge } from "@/components/atoms/Badge";
import { MainNav, type MainNavItem } from "./MainNav";
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

/** Authenticated app header: brand, clinic, section nav, current user + role, sign out. */
export function Topbar({ locale, clinicName, userName, role }: TopbarProps) {
  const t = getT(locale);

  const items: MainNavItem[] = [
    { href: "/dashboard", label: t("nav.dashboard") },
    { href: "/patients", label: t("nav.patients") },
    { href: "/reports", label: t("nav.reports") },
    { href: "/bills", label: t("nav.bills") },
    ...(role === "owner"
      ? [
          { href: "/templates", label: t("nav.templates") },
          { href: "/services", label: t("nav.services") },
          { href: "/revenue", label: t("nav.revenue") },
          { href: "/team", label: t("nav.team") },
          { href: "/settings", label: t("nav.settings") },
        ]
      : []),
  ];

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface-raised">
      <div className="flex items-center justify-between gap-4 px-6 py-2.5">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex shrink-0 items-center gap-2.5">
            <Wordmark locale={locale} className="text-lg" />
            <span className="h-5 w-px bg-border" aria-hidden="true" />
            <span className="max-w-[12rem] truncate text-sm font-medium text-ink" title={clinicName}>
              {clinicName}
            </span>
          </div>
          <MainNav items={items} label={t("nav.primary")} />
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden text-sm text-ink-subtle sm:inline">{userName}</span>
          <Badge tone="neutral">{t(`roles.${role}`)}</Badge>
          <LogoutButton label={t("auth.signOut")} />
        </div>
      </div>
    </header>
  );
}
