import { describe, it, expect } from "vitest";
import { billSchema, billItemSchema, paymentSchema } from "@/lib/schema/bill";
import { patientSchema } from "@/lib/schema/patient";
import { serviceSchema } from "@/lib/schema/service";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("billItemSchema", () => {
  it("accepts a valid line and coerces a string quantity", () => {
    const res = billItemSchema.safeParse({ description: "FBC", quantity: "2", unitPriceRupees: "1500" });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.quantity).toBe(2);
      expect(res.data.unitPriceRupees).toBe(1500);
    }
  });

  it("requires a non-empty description and quantity >= 1", () => {
    expect(billItemSchema.safeParse({ description: "", quantity: 1, unitPriceRupees: 10 }).success).toBe(false);
    expect(billItemSchema.safeParse({ description: "X", quantity: 0, unitPriceRupees: 10 }).success).toBe(false);
  });
});

describe("billSchema", () => {
  it("accepts a bill with at least one item and defaults discount to 0", () => {
    const res = billSchema.safeParse({ patientId: UUID, items: [{ description: "X", quantity: 1, unitPriceRupees: 10 }] });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.discountRupees).toBe(0);
  });

  it("rejects an empty item list and a non-uuid patient", () => {
    expect(billSchema.safeParse({ patientId: UUID, items: [] }).success).toBe(false);
    expect(billSchema.safeParse({ patientId: "x", items: [{ description: "X", quantity: 1, unitPriceRupees: 10 }] }).success).toBe(false);
  });
});

describe("paymentSchema", () => {
  it("accepts a positive amount and a known method", () => {
    expect(paymentSchema.safeParse({ amountRupees: "150.50", method: "cash" }).success).toBe(true);
  });

  it("rejects zero/negative amounts and unknown methods", () => {
    expect(paymentSchema.safeParse({ amountRupees: 0, method: "cash" }).success).toBe(false);
    expect(paymentSchema.safeParse({ amountRupees: -5, method: "cash" }).success).toBe(false);
    expect(paymentSchema.safeParse({ amountRupees: 10, method: "bitcoin" }).success).toBe(false);
  });
});

describe("patientSchema", () => {
  it("accepts the minimal required fields (name + phone)", () => {
    const res = patientSchema.safeParse({ fullName: "Nimal Perera", phone: "0712345678" });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.nic).toBe(""); // optional text normalised to empty
      expect(res.data.gender).toBe("");
    }
  });

  it("rejects a too-short phone and a phone with letters", () => {
    expect(patientSchema.safeParse({ fullName: "X", phone: "123" }).success).toBe(false);
    expect(patientSchema.safeParse({ fullName: "X", phone: "07-ABC-123" }).success).toBe(false);
  });

  it("requires a non-empty name", () => {
    expect(patientSchema.safeParse({ fullName: "  ", phone: "0712345678" }).success).toBe(false);
  });

  it("accepts a valid gender and dob but rejects malformed ones", () => {
    expect(patientSchema.safeParse({ fullName: "X", phone: "0712345678", gender: "female", dob: "1990-05-01" }).success).toBe(true);
    expect(patientSchema.safeParse({ fullName: "X", phone: "0712345678", gender: "alien" }).success).toBe(false);
    expect(patientSchema.safeParse({ fullName: "X", phone: "0712345678", dob: "01-05-1990" }).success).toBe(false);
  });
});

describe("serviceSchema", () => {
  it("accepts a valid service and coerces a string price", () => {
    const res = serviceSchema.safeParse({ name: "Consultation", priceRupees: "1500" });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.priceRupees).toBe(1500);
  });

  it("rejects a negative price and an empty name", () => {
    expect(serviceSchema.safeParse({ name: "X", priceRupees: -1 }).success).toBe(false);
    expect(serviceSchema.safeParse({ name: "", priceRupees: 10 }).success).toBe(false);
  });
});
