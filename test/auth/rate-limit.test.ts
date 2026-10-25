import { describe, expect, it } from "vitest";
import { clientIp, isBlocked, MAX_FAILURES_PER_EMAIL, MAX_FAILURES_PER_IP } from "@/lib/auth/rate-limit";

describe("sign-in rate limiting", () => {
  it("blocks after 5 failures for one email or 20 from one IP", () => {
    expect(MAX_FAILURES_PER_EMAIL).toBe(5);
    expect(MAX_FAILURES_PER_IP).toBe(20);
    expect(isBlocked(4, 19)).toBe(false);
    expect(isBlocked(5, 0)).toBe(true);
    expect(isBlocked(0, 20)).toBe(true);
  });

  it("reads the client IP from proxy headers", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "100.101.102.103, 10.0.0.5" }))).toBe("100.101.102.103");
    expect(clientIp(new Headers({ "x-real-ip": "100.64.0.9" }))).toBe("100.64.0.9");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
