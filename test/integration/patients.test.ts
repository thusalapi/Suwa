import { describe, it, expect, beforeEach } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import {
  createPatient,
  updatePatient,
  getPatient,
  findByPhone,
  searchPatients,
} from "@/lib/patients";
import type { PatientInput } from "@/lib/schema/patient";
import { resetDb, seedClinic, seedUser } from "./helpers";

beforeEach(resetDb);

const base: PatientInput = {
  fullName: "Nimal Perera",
  phone: "0771234567",
  nic: "",
  gender: "male",
  dob: "1980-01-01",
  address: "",
  notes: "",
};

async function ctx() {
  const clinicId = await seedClinic();
  const userId = await seedUser(clinicId);
  return { clinicId, userId };
}

describe("createPatient", () => {
  it("creates a patient, mapping empty optionals to NULL, and audits it", async () => {
    const { clinicId, userId } = await ctx();
    const id = await createPatient(clinicId, userId, base);

    const p = await getPatient(clinicId, id);
    expect(p).toMatchObject({ fullName: "Nimal Perera", phone: "0771234567", gender: "male", dob: "1980-01-01" });
    expect(p!.nic).toBeNull(); // empty string → NULL
    expect(p!.address).toBeNull();

    const audit = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityId, id), eq(auditLogs.action, "patient.create")));
    expect(audit).toHaveLength(1);
  });

  it("enforces the unique (clinic, phone) constraint", async () => {
    const { clinicId, userId } = await ctx();
    await createPatient(clinicId, userId, base);
    await expect(createPatient(clinicId, userId, { ...base, fullName: "Someone Else" })).rejects.toThrow();
  });

  it("allows the same phone in a different clinic (tenant-scoped uniqueness)", async () => {
    const a = await ctx();
    const b = await ctx();
    await createPatient(a.clinicId, a.userId, base);
    await expect(createPatient(b.clinicId, b.userId, base)).resolves.toBeTruthy();
  });
});

describe("getPatient / findByPhone", () => {
  it("is tenant-scoped (won't read another clinic's patient)", async () => {
    const a = await ctx();
    const b = await ctx();
    const id = await createPatient(a.clinicId, a.userId, base);
    expect(await getPatient(a.clinicId, id)).not.toBeNull();
    expect(await getPatient(b.clinicId, id)).toBeNull();
  });

  it("findByPhone dedupes, and excludeId skips the patient being edited", async () => {
    const { clinicId, userId } = await ctx();
    const id = await createPatient(clinicId, userId, base);
    expect(await findByPhone(clinicId, "0771234567")).toMatchObject({ id, fullName: "Nimal Perera" });
    expect(await findByPhone(clinicId, "0771234567", id)).toBeNull(); // editing self
    expect(await findByPhone(clinicId, "0000000000")).toBeNull();
  });
});

describe("updatePatient", () => {
  it("updates fields and audits it", async () => {
    const { clinicId, userId } = await ctx();
    const id = await createPatient(clinicId, userId, base);
    await updatePatient(clinicId, userId, id, { ...base, fullName: "Nimal P.", nic: "801234567V" });

    const p = await getPatient(clinicId, id);
    expect(p!.fullName).toBe("Nimal P.");
    expect(p!.nic).toBe("801234567V");

    const audit = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityId, id), eq(auditLogs.action, "patient.update")));
    expect(audit).toHaveLength(1);
  });

  it("can't update across clinics", async () => {
    const a = await ctx();
    const b = await ctx();
    const id = await createPatient(a.clinicId, a.userId, base);
    await updatePatient(b.clinicId, b.userId, id, { ...base, fullName: "Hacker" });
    expect((await getPatient(a.clinicId, id))!.fullName).toBe("Nimal Perera"); // unchanged
  });
});

describe("searchPatients", () => {
  it("matches by partial phone and name, case-insensitively, and lists recent when empty", async () => {
    const { clinicId, userId } = await ctx();
    await createPatient(clinicId, userId, base); // Nimal Perera, 0771234567
    await createPatient(clinicId, userId, { ...base, fullName: "Kamala Silva", phone: "0719998888" });

    expect((await searchPatients(clinicId, "perera")).map((p) => p.fullName)).toEqual(["Nimal Perera"]);
    expect((await searchPatients(clinicId, "0771")).map((p) => p.fullName)).toEqual(["Nimal Perera"]);
    expect(await searchPatients(clinicId, "")).toHaveLength(2); // recent
  });

  it("never returns another clinic's patients", async () => {
    const a = await ctx();
    const b = await ctx();
    await createPatient(a.clinicId, a.userId, base);
    expect(await searchPatients(b.clinicId, "perera")).toHaveLength(0);
  });
});
