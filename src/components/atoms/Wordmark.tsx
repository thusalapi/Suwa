import { cn } from "@/lib/utils/cn";
import { brand } from "@/lib/branding/brand";
import type { Locale } from "@/lib/i18n/types";
import { brandName } from "@/lib/branding/brand";

export interface WordmarkProps {
  locale?: Locale;
  className?: string;
}

/** Product brand wordmark. Reads the name from branding config — never hard-coded. */
export function Wordmark({ locale, className }: WordmarkProps) {
  return (
    <span className={cn("text-xl font-bold tracking-tight text-primary", className)}>
      {brandName(locale)}
      <span className="sr-only"> — {brand.tagline}</span>
    </span>
  );
}
