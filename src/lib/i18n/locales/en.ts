/**
 * Canonical key set (source of truth). English-only at launch — this is the single
 * dictionary. Any locale added later lives in its own `locales/*.ts` file, mirrors this
 * shape, and falls back to `en` for missing keys. Never put a user-facing string in a
 * component — add it here first.
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
    signingIn: "Signing in…",
    signOut: "Sign out",
    invalidEmail: "Enter a valid email address.",
    required: "This field is required.",
    invalidCredentials: "Incorrect email or password.",
    unexpectedError: "Something went wrong. Please try again.",
  },
  roles: {
    owner: "Owner",
    staff: "Staff",
    doctor: "Doctor",
  },
  nav: {
    dashboard: "Dashboard",
  },
  dashboard: {
    title: "Dashboard",
    welcome: "Welcome back, {name}",
    comingSoon: "Modules will appear here as they’re built.",
  },
  patients: {
    phone: "Phone number",
    phoneHint: "Used to find the patient",
    nic: "NIC",
    nicOptional: "NIC (optional)",
  },
};

export type Dictionary = typeof en;
