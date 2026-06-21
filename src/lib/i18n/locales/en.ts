/**
 * Canonical key set (source of truth). `si` and `ta` mirror this shape; missing keys
 * fall back to `en`. Never put a user-facing string in a component — add it here first.
 */
export const en = {
  common: {
    loading: "Loading…",
    save: "Save",
    cancel: "Cancel",
    search: "Search",
  },
  auth: {
    loginTitle: "Sign in",
    loginSubtitle: "Sign in to continue",
    email: "Email",
    emailPlaceholder: "you@clinic.lk",
    password: "Password",
    passwordPlaceholder: "Your password",
    submit: "Sign in",
  },
  patients: {
    phone: "Phone number",
    phoneHint: "Used to find the patient",
    nic: "NIC",
    nicOptional: "NIC (optional)",
  },
};

export type Dictionary = typeof en;
