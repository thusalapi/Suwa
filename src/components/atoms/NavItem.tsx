import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface NavItemProps {
  href: string;
  /** Marks the section currently being viewed. */
  active?: boolean;
  children: ReactNode;
}

/**
 * A navigation destination styled as a pill button, so it reads as clickable rather than as
 * body text. The current section is signalled by weight and a tinted surface — not colour
 * alone — and carries `aria-current="page"` for screen readers. The 36px height keeps the
 * hit area comfortably above the 24px minimum target size.
 */
export function NavItem({ href, active = false, children }: NavItemProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-9 items-center whitespace-nowrap rounded-md px-3 text-sm",
        "transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        active
          ? "bg-primary-soft font-semibold text-primary-dark"
          : "font-medium text-ink-subtle hover:bg-surface hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}
