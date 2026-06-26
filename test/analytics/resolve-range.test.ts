import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { resolveRange } from "@/lib/analytics";

// Pin "now" to 2026-06-27 (local) so month-to-date defaults are deterministic across run dates.
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 5, 27, 10, 0, 0));
});
afterAll(() => vi.useRealTimers());

describe("resolveRange", () => {
  it("defaults to month-to-date when nothing is given", () => {
    expect(resolveRange(undefined, undefined)).toEqual({ from: "2026-06-01", to: "2026-06-27" });
  });

  it("passes through a valid in-order range", () => {
    expect(resolveRange("2026-06-10", "2026-06-20")).toEqual({ from: "2026-06-10", to: "2026-06-20" });
  });

  it("falls back to the default when from is after to", () => {
    expect(resolveRange("2026-06-20", "2026-06-10")).toEqual({ from: "2026-06-01", to: "2026-06-27" });
  });

  it("replaces a malformed bound with its default and keeps the valid one", () => {
    expect(resolveRange("garbage", "2026-06-20")).toEqual({ from: "2026-06-01", to: "2026-06-20" });
  });

  it("defaults both bounds when both are malformed", () => {
    expect(resolveRange("nope", "also-nope")).toEqual({ from: "2026-06-01", to: "2026-06-27" });
  });
});
