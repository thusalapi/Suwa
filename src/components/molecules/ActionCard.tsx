import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/atoms/icons";

export interface ActionCardProps {
  href: string;
  icon: ReactNode;
  title: string;
  subtitle?: string;
}

/** A quick-action tile: tinted icon + title/subtitle, with a hover arrow. Links somewhere. */
export function ActionCard({ href, icon, title, subtitle }: ActionCardProps) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-border bg-surface-raised p-4 transition-colors hover:border-primary/40 hover:bg-surface"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-dark">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        {subtitle ? <span className="block truncate text-xs text-muted">{subtitle}</span> : null}
      </span>
      <ArrowRightIcon className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}
