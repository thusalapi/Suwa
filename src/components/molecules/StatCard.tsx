import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export type StatTone = "primary" | "accent" | "success" | "warning" | "danger";

const toneChip: Record<StatTone, string> = {
  primary: "bg-primary/10 text-primary-dark",
  accent: "bg-accent/10 text-accent",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/10 text-danger",
};

export interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** Small icon shown in a tinted chip (e.g. `<CoinsIcon className="h-5 w-5" />`). */
  icon?: ReactNode;
  tone?: StatTone;
  /** When set, the whole card becomes a link with a hover affordance. */
  href?: string;
}

/** A single dashboard metric: label, optional tinted icon, prominent value, optional sub-line. */
export function StatCard({ label, value, hint, icon, tone = "primary", href }: StatCardProps) {
  const inner = (
    <div
      className={cn(
        "h-full rounded-xl border border-border bg-surface-raised p-4 transition-shadow",
        href && "hover:border-primary/40 hover:shadow-sm",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        {icon ? (
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", toneChip[tone])}>
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );

  return href ? (
    <Link href={href} className="block h-full">
      {inner}
    </Link>
  ) : (
    inner
  );
}
