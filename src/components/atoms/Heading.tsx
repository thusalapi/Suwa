import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * The type scale, in one place. Every screen's heading levels come from here so the visual
 * hierarchy (page → section → sub-section) stays consistent and each step is a clear size or
 * weight drop. Headings carry real `h1`/`h2`/`h3` elements, so the document outline screen
 * readers announce matches the hierarchy sighted users see.
 */
export interface HeadingProps {
  children: ReactNode;
  className?: string;
  id?: string;
}

/** One per screen: the page's subject. */
export function PageTitle({ children, className, id }: HeadingProps) {
  return (
    <h1 id={id} className={cn("text-2xl font-semibold tracking-tight text-ink", className)}>
      {children}
    </h1>
  );
}

/** A major block within a page. Stays above body size so it reads as a step down, not up. */
export function SectionTitle({ children, className, id }: HeadingProps) {
  return (
    <h2 id={id} className={cn("text-base font-semibold text-ink", className)}>
      {children}
    </h2>
  );
}

/** A labelled group inside a section (e.g. a results table's title). */
export function SubsectionTitle({ children, className, id }: HeadingProps) {
  return (
    <h3 id={id} className={cn("text-sm font-semibold text-ink", className)}>
      {children}
    </h3>
  );
}
