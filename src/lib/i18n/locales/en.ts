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
    settings: "Settings",
  },
  dashboard: {
    title: "Dashboard",
    welcome: "Welcome back, {name}",
    comingSoon: "Modules will appear here as they’re built.",
  },
  settings: {
    title: "Clinic settings",
    subtitle: "Your clinic’s identity and billing defaults.",
    clinicName: "Clinic name",
    address: "Address",
    phone: "Phone number",
    logoUrl: "Logo URL",
    logoUrlHint: "Path or URL to the logo shown on bills and reports.",
    currency: "Currency",
    currencyHint: "Three-letter code, e.g. LKR.",
    taxRate: "Tax rate (%)",
    taxRateHint: "Default tax applied to bills.",
    save: "Save changes",
    saving: "Saving…",
    saved: "Settings saved.",
    nameRequired: "Clinic name is required.",
    currencyInvalid: "Enter a three-letter currency code.",
    taxRateInvalid: "Enter a tax rate between 0 and 100.",
    saveError: "Couldn’t save settings. Please try again.",
  },
  patients: {
    phone: "Phone number",
    phoneHint: "Used to find the patient",
    nic: "NIC",
    nicOptional: "NIC (optional)",
  },
};

export type Dictionary = typeof en;
