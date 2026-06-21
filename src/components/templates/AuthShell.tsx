import type { ReactNode } from "react";
import { Wordmark } from "@/components/atoms/Wordmark";
import { brand } from "@/lib/branding/brand";
import type { Locale } from "@/lib/i18n/types";

export interface AuthShellProps {
  locale?: Locale;
  children: ReactNode;
}

/** Centered shell for unauthenticated screens (login). Layout only — no business data. */
export function AuthShell({ locale, children }: AuthShellProps) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <Wordmark locale={locale} className="text-2xl" />
          <p className="text-sm text-muted">{brand.tagline}</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm">{children}</div>
      </div>
    </main>
  );
}
