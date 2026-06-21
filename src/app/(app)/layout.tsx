import type { ReactNode } from "react";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { clinics } from "@/lib/db/schema";
import { Topbar } from "@/components/molecules/Topbar";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";

/**
 * Gate for every authenticated screen. Middleware already blocks unauthenticated requests,
 * but we re-resolve the user server-side here (defense in depth) and load the clinic identity
 * for the header.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const locale = DEFAULT_LOCALE; // per-user locale lands with settings.

  const [clinic] = await db
    .select({ name: clinics.name })
    .from(clinics)
    .where(eq(clinics.id, user.clinicId))
    .limit(1);

  return (
    <div className="min-h-screen bg-surface">
      <Topbar
        locale={locale}
        clinicName={clinic?.name ?? ""}
        userName={user.name}
        role={user.role}
      />
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
