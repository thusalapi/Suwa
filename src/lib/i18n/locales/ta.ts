import type { Dictionary } from "./en";

/** Tamil. Mirrors the shape of `en`. */
export const ta: Dictionary = {
  common: {
    loading: "ஏற்றுகிறது…",
    save: "சேமி",
    cancel: "ரத்து செய்",
    search: "தேடு",
  },
  auth: {
    loginTitle: "உள்நுழைக",
    loginSubtitle: "தொடர உள்நுழைக",
    email: "மின்னஞ்சல்",
    emailPlaceholder: "you@clinic.lk",
    password: "கடவுச்சொல்",
    passwordPlaceholder: "உங்கள் கடவுச்சொல்",
    submit: "உள்நுழைக",
  },
  patients: {
    phone: "தொலைபேசி எண்",
    phoneHint: "நோயாளியைக் கண்டறியப் பயன்படுகிறது",
    nic: "தே.அ.அட்டை",
    nicOptional: "தே.அ.அட்டை (விருப்பத்தேர்வு)",
  },
};
