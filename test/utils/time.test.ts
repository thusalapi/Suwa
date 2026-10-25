import { describe, expect, it } from "vitest";
import { appTimeZone, todayInZone, zonedDay, zonedDayEnd, zonedDayStart, zonedParts } from "@/lib/time";

// All instants are explicit UTC, so these pass whatever zone the test machine (or a cloud
// server) runs in. Sri Lanka is UTC+05:30 with no daylight saving.
const utc = (iso: string) => new Date(`${iso}Z`);

describe("clinic clock (APP_TIMEZONE)", () => {
  it("defaults to Asia/Colombo", () => {
    expect(appTimeZone()).toBe("Asia/Colombo");
  });

  it("reads wall-clock time in the clinic's zone, not the server's", () => {
    expect(zonedParts(utc("2026-10-24T05:46:00"))).toMatchObject({
      year: 2026,
      month: 10,
      day: 24,
      hour: 11,
      minute: 16,
    });
  });

  it("rolls the date over at the clinic's midnight", () => {
    expect(zonedDay(utc("2026-10-24T18:29:59"))).toBe("2026-10-24"); // 23:59:59 in Colombo
    expect(zonedDay(utc("2026-10-24T18:30:00"))).toBe("2026-10-25"); // 00:00 next day
    expect(todayInZone(utc("2026-10-24T20:00:00"))).toBe("2026-10-25");
  });

  it("gives the instants a clinic day starts and ends (for dashboard and revenue bounds)", () => {
    expect(zonedDayStart("2026-10-25").toISOString()).toBe("2026-10-24T18:30:00.000Z");
    expect(zonedDayEnd("2026-10-25").toISOString()).toBe("2026-10-25T18:30:00.000Z");
    expect(zonedDayEnd("2026-12-31").toISOString()).toBe("2026-12-31T18:30:00.000Z"); // year rollover
  });

  it("works for another zone too", () => {
    expect(zonedDayStart("2026-07-01", "Europe/London").toISOString()).toBe("2026-06-30T23:00:00.000Z"); // BST
    expect(zonedDayStart("2026-01-15", "Europe/London").toISOString()).toBe("2026-01-15T00:00:00.000Z");
  });
});
