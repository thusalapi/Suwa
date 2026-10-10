import type { ReactNode } from "react";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { clinics } from "@/lib/db/schema";
import { Topbar } from "@/components/molecules/Topbar";
import { getT } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";

/**
 * Gate for every authenticated screen. Middleware already blocks unauthenticated requests,
 * but we re-resolve the user server-side here (defense in depth) and load the clinic identity
 * for the header.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  // Invited users must set their own password before reaching any app screen. /reset-password
  // lives outside this layout, so this redirect can't loop.
  if (user.mustReset) redirect("/reset-password");
  const locale = DEFAULT_LOCALE; // per-user locale lands with settings.

  const [clinic] = await db.select({ name: clinics.name }).from(clinics).where(eq(clinics.id, user.clinicId)).limit(1);

  const t = getT(locale);

  return (
    <div className="min-h-screen bg-surface">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-30 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-fg"
      >
        {t("nav.skipToContent")}
      </a>
      <Topbar locale={locale} clinicName={clinic?.name ?? ""} userName={user.name} role={user.role} />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-5xl px-6 py-8">
        {children}
      </main>
    </div>
  );
}
