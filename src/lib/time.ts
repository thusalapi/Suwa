/**
 * The clinic's clock. Every "today", day boundary and printed time goes through here, so the app
 * gives the same answers on the clinic PC and on a cloud server that runs on UTC.
 *
 * One zone for the whole install: `APP_TIMEZONE` (IANA name), default Asia/Colombo. A per-clinic
 * zone is only needed if a clinic outside Sri Lanka joins (see docs/production-plan.md).
 */

export const DEFAULT_TIMEZONE = "Asia/Colombo";

/** The configured IANA time zone. Falls back to Asia/Colombo when unset or invalid. */
export function appTimeZone(): string {
  const tz = typeof process !== "undefined" ? process.env.APP_TIMEZONE : undefined;
  if (!tz) return DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

export interface ZonedParts {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatterFor(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(tz, f);
  }
  return f;
}

/** Wall-clock date and time of an instant in the clinic's zone. */
export function zonedParts(date: Date, tz: string = appTimeZone()): ZonedParts {
  const parts: Record<string, number> = {};
  for (const p of formatterFor(tz).formatToParts(date)) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** An instant's day in the clinic's zone, as "YYYY-MM-DD". */
export function zonedDay(date: Date, tz: string = appTimeZone()): string {
  const p = zonedParts(date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Today in the clinic's zone, as "YYYY-MM-DD". */
export function todayInZone(now: Date = new Date(), tz: string = appTimeZone()): string {
  return zonedDay(now, tz);
}

/** The zone's offset from UTC at an instant, in ms (e.g. +5:30 → 19_800_000). */
function offsetMs(date: Date, tz: string): number {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** The instant midnight starts on a "YYYY-MM-DD" day in the clinic's zone. */
export function zonedDayStart(day: string, tz: string = appTimeZone()): Date {
  const [y, m, d] = day.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  // Two passes settle the offset even across a DST change (none in Asia/Colombo).
  let t = guess - offsetMs(new Date(guess), tz);
  t = guess - offsetMs(new Date(t), tz);
  return new Date(t);
}

/** The instant the day after "YYYY-MM-DD" starts (exclusive end of that day). */
export function zonedDayEnd(day: string, tz: string = appTimeZone()): Date {
  const [y, m, d] = day.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return zonedDayStart(`${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`, tz);
}
