import type { ReactNode } from "react";
import { Label } from "./Label";

export interface FieldProps {
  /** Label text — atoms take their copy as props (caller resolves via t()). */
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

/** Label + control + hint/error. The smallest reusable form unit. */
export function Field({ label, htmlFor, hint, error, children }: FieldProps) {
  const describedBy = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p id={describedBy} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={describedBy} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
