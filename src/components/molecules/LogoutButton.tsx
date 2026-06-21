"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/atoms/Button";
import { logoutAction } from "@/lib/auth/actions";

function Inner({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="ghost" size="sm" disabled={pending}>
      {label}
    </Button>
  );
}

/** Sign-out control. Label is resolved by the caller via t() (no hard-coded copy). */
export function LogoutButton({ label }: { label: string }) {
  return (
    <form action={logoutAction}>
      <Inner label={label} />
    </form>
  );
}
