import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, nowForDateTimeInput } from "@/lib/i18n";
import { formatPatientValue, formatStoredDateTime } from "@/lib/report-engine/display";

// 2026-10-24 05:46 UTC = 24 Oct 2026 11:16 in Sri Lanka (UTC+05:30). Explicit UTC instants keep
// these independent of the machine's own zone.
const instant = new Date("2026-10-24T05:46:00Z");

describe("date & time in the lab's printed style, on the clinic's clock", () => {
  it("prints bills and payments as dd/mm/yyyy HH:mm in clinic time", () => {
    expect(formatDateTime(instant)).toBe("24/10/2026 11:16");
    expect(formatDateTime(new Date("2026-01-05T03:33:00Z"))).toBe("05/01/2026 09:03");
    expect(formatDateTime(new Date("2026-10-24T18:45:00Z"))).toBe("25/10/2026 00:15"); // past clinic midnight
  });

  it("prefills a report's Date & Time input with now in clinic time", () => {
    expect(nowForDateTimeInput(instant)).toBe("2026-10-24T11:16");
  });

  it("formats a bare calendar day as that day", () => {
    expect(formatDate("2026-10-25")).toMatch(/25/);
    expect(formatDate("2026-10-25")).toMatch(/2026/);
  });

  it("prints a stored report Date & Time the same way, without timezone shifts", () => {
    expect(formatStoredDateTime("2026-10-24T11:16")).toBe("24/10/2026 11:16");
    expect(formatStoredDateTime("2026-10-24")).toBe("24/10/2026");
    expect(formatStoredDateTime("yesterday")).toBe("yesterday");
    expect(formatPatientValue("datetime", "2026-10-24T11:16")).toBe("24/10/2026 11:16");
  });
});
