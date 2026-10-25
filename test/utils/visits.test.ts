import { describe, expect, it } from "vitest";
import { groupVisits, localDay, reportVisitDay } from "@/lib/visits";

// h:00 on that day in Sri Lanka (UTC+05:30), as an explicit instant.
const at = (y: number, m: number, d: number, h = 10) => new Date(Date.UTC(y, m - 1, d, h) - 5.5 * 3600 * 1000);

describe("visits", () => {
  it("puts a report on its specimen day, even when it was finished the next day", () => {
    expect(reportVisitDay({ id: "r", createdAt: at(2026, 10, 25), specimenAt: "2026-10-24T11:16" })).toBe("2026-10-24");
    expect(reportVisitDay({ id: "r", createdAt: at(2026, 10, 25), specimenAt: null })).toBe("2026-10-25");
    expect(reportVisitDay({ id: "r", createdAt: at(2026, 10, 25), specimenAt: "" })).toBe("2026-10-25");
  });

  it("groups reports and bills of the same day into one visit, newest day first", () => {
    const reports = [
      { id: "r1", createdAt: at(2026, 10, 25), specimenAt: "2026-10-25T09:00" },
      { id: "r2", createdAt: at(2026, 10, 25), specimenAt: "2026-10-24T11:16" },
      { id: "r3", createdAt: at(2026, 10, 20) },
    ];
    const bills = [
      { id: "b1", createdAt: at(2026, 10, 25, 9), status: "finalized", total: 2000_00, balance: 500_00 },
      { id: "b2", createdAt: at(2026, 10, 24, 11), status: "paid", total: 1500_00, balance: 0 },
      { id: "b3", createdAt: at(2026, 10, 24, 12), status: "cancelled", total: 900_00, balance: 900_00 },
    ];
    const visits = groupVisits(reports, bills);

    expect(visits.map((v) => v.date)).toEqual(["2026-10-25", "2026-10-24", "2026-10-20"]);
    expect(visits[0].reports.map((r) => r.id)).toEqual(["r1"]);
    expect(visits[0].bills.map((b) => b.id)).toEqual(["b1"]);
    expect(visits[0]).toMatchObject({ billed: 2000_00, outstanding: 500_00 });

    // 24th: the report finished on the 25th still belongs here; the cancelled bill is listed but not counted.
    expect(visits[1].reports.map((r) => r.id)).toEqual(["r2"]);
    expect(visits[1].bills.map((b) => b.id)).toEqual(["b2", "b3"]);
    expect(visits[1]).toMatchObject({ billed: 1500_00, outstanding: 0 });

    expect(visits[2]).toMatchObject({ date: "2026-10-20", bills: [], billed: 0 });
  });

  it("uses the clinic's calendar day", () => {
    expect(localDay(at(2026, 1, 5, 23))).toBe("2026-01-05");
    expect(localDay(new Date("2026-01-05T18:30:00Z"))).toBe("2026-01-06"); // clinic midnight
  });
});
