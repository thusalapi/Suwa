import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { brand, brandCssVars } from "@/lib/branding/brand";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";

export const metadata: Metadata = {
  title: `${brand.name} — ${brand.tagline}`,
  description: `${brand.name}: self-hosted clinic management.`,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={DEFAULT_LOCALE} style={brandCssVars}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
