import type { Dictionary } from "./en";

/** Sinhala. Mirrors the shape of `en`. */
export const si: Dictionary = {
  common: {
    loading: "පූරණය වෙමින්…",
    save: "සුරකින්න",
    cancel: "අවලංගු කරන්න",
    search: "සොයන්න",
  },
  auth: {
    loginTitle: "ඇතුල් වන්න",
    loginSubtitle: "ඉදිරියට යාමට ඇතුල් වන්න",
    email: "විද්‍යුත් තැපෑල",
    emailPlaceholder: "you@clinic.lk",
    password: "මුරපදය",
    passwordPlaceholder: "ඔබගේ මුරපදය",
    submit: "ඇතුල් වන්න",
  },
  patients: {
    phone: "දුරකථන අංකය",
    phoneHint: "රෝගියා සොයා ගැනීමට භාවිතා වේ",
    nic: "ජා.හැ.අංකය",
    nicOptional: "ජා.හැ.අංකය (අත්‍යවශ්‍ය නොවේ)",
  },
};
