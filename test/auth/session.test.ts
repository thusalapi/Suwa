import { describe, it, expect } from "vitest";

// session.ts reads SESSION_SECRET at call time — set a valid one before importing.
process.env.SESSION_SECRET = "test-secret-at-least-16-chars-long";

const { createSessionToken, verifySessionToken, SESSION_MAX_AGE_SECONDS } = await import("@/lib/auth/session");

const user = { id: "u1", clinicId: "c1", role: "owner" as const };

describe("session token", () => {
  it("round-trips a signed token back to its payload", async () => {
    const token = await createSessionToken(user);
    const payload = await verifySessionToken(token);
    expect(payload).toMatchObject({ sub: "u1", clinicId: "c1", role: "owner" });
    expect(payload!.exp).toBe(payload!.iat + SESSION_MAX_AGE_SECONDS);
  });

  it("returns null for a missing/empty token", async () => {
    expect(await verifySessionToken(undefined)).toBeNull();
    expect(await verifySessionToken(null)).toBeNull();
    expect(await verifySessionToken("")).toBeNull();
  });

  it("rejects a malformed token (no signature separator)", async () => {
    expect(await verifySessionToken("notadottoken")).toBeNull();
  });

  it("rejects a tampered payload (signature no longer matches)", async () => {
    const token = await createSessionToken(user);
    const [body, sig] = token.split(".");
    // Flip the last character of the body so the HMAC no longer verifies.
    const tampered = `${body.slice(0, -1)}${body.slice(-1) === "A" ? "B" : "A"}.${sig}`;
    expect(await verifySessionToken(tampered)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const past = Math.floor(Date.now() / 1000) - SESSION_MAX_AGE_SECONDS - 10;
    const token = await createSessionToken(user, past);
    expect(await verifySessionToken(token)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken(user);
    const original = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "a-completely-different-secret-value";
    try {
      expect(await verifySessionToken(token)).toBeNull();
    } finally {
      process.env.SESSION_SECRET = original;
    }
  });
});
