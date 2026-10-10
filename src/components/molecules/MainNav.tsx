"use client";

import { usePathname } from "next/navigation";
import { NavItem } from "@/components/atoms/NavItem";

export interface MainNavItem {
  href: string;
  label: string;
}

export interface MainNavProps {
  items: MainNavItem[];
  /** Names the landmark, so screen readers can distinguish it from other nav regions. */
  label: string;
}

/**
 * Primary section navigation. Client-side only to read the current path — labels arrive
 * already translated from the server parent, so no i18n ships to the browser. Scrolls
 * horizontally rather than overflowing the page when the window is narrow.
 */
export function MainNav({ items, label }: MainNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label={label} className="-mx-1 flex min-w-0 items-center gap-1 overflow-x-auto px-1">
      {items.map((item) => (
        <NavItem
          key={item.href}
          href={item.href}
          active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
        >
          {item.label}
        </NavItem>
      ))}
    </nav>
  );
}
