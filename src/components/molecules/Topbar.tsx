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
      <div className="flex items-center gap-3">
        <Wordmark locale={locale} className="text-lg" />
        <span className="text-sm text-muted">{clinicName}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-ink">{userName}</span>
        <Badge tone="neutral">{t(`roles.${role}`)}</Badge>
        <LogoutButton label={t("auth.signOut")} />
      </div>
    </header>
  );
}
