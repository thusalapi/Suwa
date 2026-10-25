import { describe, expect, it } from "vitest";
import { ageFromDob, estimatedDobFromAge } from "@/lib/utils/age";
import { patientSchema } from "@/lib/schema/patient";

describe("age helpers", () => {
  const today = new Date(2026, 9, 25); // 25 Oct 2026

  it("an estimated dob gives back the entered age today", () => {
    expect(estimatedDobFromAge(67, today)).toBe("1959-10-25");
    expect(ageFromDob(estimatedDobFromAge(67, today), today)).toBe(67);
  });

  it("keeps counting up a year later", () => {
    expect(ageFromDob(estimatedDobFromAge(67, today), new Date(2027, 9, 25))).toBe(68);
  });

  it("clamps 29 Feb to 28 Feb in a non-leap birth year", () => {
    expect(estimatedDobFromAge(3, new Date(2028, 1, 29))).toBe("2025-02-28");
  });
});

describe("patient age input", () => {
  const base = { fullName: "A", phone: "0771234567" };

  it("accepts a blank or whole-number age", () => {
    expect(patientSchema.parse({ ...base, age: "" }).age).toBe("");
    expect(patientSchema.parse({ ...base, age: "67" }).age).toBe(67);
  });

  it("rejects fractional, negative or absurd ages", () => {
    for (const age of ["6.5", "-1", "200", "abc"]) {
      expect(patientSchema.safeParse({ ...base, age }).success).toBe(false);
    }
  });
});
