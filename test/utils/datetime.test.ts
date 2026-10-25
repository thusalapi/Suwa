import { describe, expect, it } from "vitest";
import { formatDateTime, nowForDateTimeInput } from "@/lib/i18n";
import { formatPatientValue, formatStoredDateTime } from "@/lib/report-engine/display";

describe("date & time in the lab's printed style", () => {
  const d = new Date(2026, 9, 24, 11, 16); // 24 Oct 2026 11:16 local

  it("prints bills and payments as dd/mm/yyyy HH:mm", () => {
    expect(formatDateTime(d)).toBe("24/10/2026 11:16");
    expect(formatDateTime(new Date(2026, 0, 5, 9, 3))).toBe("05/01/2026 09:03");
  });

  it("prefills a report's Date & Time input with now (local clock)", () => {
    expect(nowForDateTimeInput(d)).toBe("2026-10-24T11:16");
  });

  it("prints a stored report Date & Time the same way, without timezone shifts", () => {
    expect(formatStoredDateTime("2026-10-24T11:16")).toBe("24/10/2026 11:16");
    expect(formatStoredDateTime("2026-10-24")).toBe("24/10/2026");
    expect(formatStoredDateTime("yesterday")).toBe("yesterday");
    expect(formatPatientValue("datetime", "2026-10-24T11:16")).toBe("24/10/2026 11:16");
  });
});
