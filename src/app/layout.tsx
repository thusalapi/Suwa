import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { brand } from "@/lib/branding/brand";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";
import { defaultTheme, themeToCssVars } from "@/lib/design/theme";

export const metadata: Metadata = {
  title: `${brand.name} — ${brand.tagline}`,
  description: `${brand.name}: self-hosted clinic management.`,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // SaaS later: resolve the tenant theme (buildTheme(clinic.brandOverride)) per request.
  const themeVars = themeToCssVars(defaultTheme);
  return (
    <html lang={DEFAULT_LOCALE} style={themeVars}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
