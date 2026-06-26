import { describe, it, expect } from "vitest";
import { getT, formatMoney, formatDate } from "@/lib/i18n";

describe("getT", () => {
  const t = getT("en");

  it("resolves a nested key", () => {
    expect(t("common.save")).toBe("Save");
  });

  it("interpolates named params", () => {
    expect(t("dashboard.welcome", { name: "Dr. Perera" })).toBe("Welcome back, Dr. Perera");
  });

  it("leaves an unfilled placeholder intact", () => {
    expect(t("dashboard.welcome")).toContain("{name}");
  });

  it("falls back to the raw key when missing", () => {
    expect(t("nope.not.a.key")).toBe("nope.not.a.key");
  });
});

describe("formatMoney", () => {
  it("renders integer minor units as major-unit currency", () => {
    expect(formatMoney(150000)).toContain("1,500.00");
    expect(formatMoney(0)).toContain("0.00");
    expect(formatMoney(99)).toContain("0.99");
  });
});

describe("formatDate", () => {
  it("formats a date with month and year", () => {
    const out = formatDate(new Date(2026, 5, 27));
    expect(out).toContain("2026");
    expect(out).toMatch(/Jun/i);
  });

  it("accepts an ISO string", () => {
    expect(formatDate("2026-06-27")).toContain("2026");
  });
});
