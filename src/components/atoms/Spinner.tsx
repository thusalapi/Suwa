import { cn } from "@/lib/utils/cn";

export interface SpinnerProps {
  /** Accessible label, resolved by the caller via t(). */
  label: string;
  className?: string;
}

export function Spinner({ label, className }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary",
        className,
      )}
    />
  );
}
