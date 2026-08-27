import { describe, it, expect, beforeEach } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, users } from "@/lib/db/schema";
import { createInvitedUser, setUserPassword, emailExists, listClinicUsers } from "@/lib/users";
import { resetDb, seedClinic, seedUser } from "./helpers";

beforeEach(resetDb);

describe("createInvitedUser", () => {
  it("creates a staff account flagged must-reset, and audits it", async () => {
    const clinicId = await seedClinic();
    const owner = await seedUser(clinicId, "owner");

    const id = await createInvitedUser(clinicId, owner, {
      name: "MLT Silva",
      email: "mlt@clinic.lk",
      role: "doctor",
      passwordHash: "temp-hash",
    });

    const [row] = await db.select().from(users).where(eq(users.id, id));
    expect(row).toMatchObject({ name: "MLT Silva", email: "mlt@clinic.lk", role: "doctor", mustReset: true });

    const audit = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityId, id), eq(auditLogs.action, "user.create")));
    expect(audit).toHaveLength(1);
    expect(audit[0].metadata).toMatchObject({ role: "doctor" });
  });

  it("rejects a duplicate email (globally unique)", async () => {
    const clinicId = await seedClinic();
    const owner = await seedUser(clinicId, "owner");
    await createInvitedUser(clinicId, owner, { name: "A", email: "dup@clinic.lk", role: "staff", passwordHash: "h" });
    await expect(
      createInvitedUser(clinicId, owner, { name: "B", email: "dup@clinic.lk", role: "staff", passwordHash: "h" }),
    ).rejects.toThrow();
  });
});

describe("setUserPassword", () => {
  it("sets the hash, clears must-reset, and audits the reset", async () => {
    const clinicId = await seedClinic();
    const owner = await seedUser(clinicId, "owner");
    const id = await createInvitedUser(clinicId, owner, {
      name: "Staff",
      email: "s@clinic.lk",
      role: "staff",
      passwordHash: "temp",
    });

    await setUserPassword(clinicId, id, "new-strong-hash");

    const [row] = await db.select().from(users).where(eq(users.id, id));
    expect(row.passwordHash).toBe("new-strong-hash");
    expect(row.mustReset).toBe(false);

    const audit = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityId, id), eq(auditLogs.action, "auth.password_reset")));
    expect(audit).toHaveLength(1);
  });

  it("is tenant-scoped (won't reset another clinic's user)", async () => {
    const a = await seedClinic();
    const b = await seedClinic();
    const ownerA = await seedUser(a, "owner");
    const id = await createInvitedUser(a, ownerA, {
      name: "S",
      email: "x@clinic.lk",
      role: "staff",
      passwordHash: "temp",
    });
    await setUserPassword(b, id, "hacked"); // wrong clinic — no-op
    const [row] = await db.select().from(users).where(eq(users.id, id));
    expect(row.passwordHash).toBe("temp");
    expect(row.mustReset).toBe(true);
  });
});

describe("emailExists / listClinicUsers", () => {
  it("detects an existing email", async () => {
    const clinicId = await seedClinic();
    const owner = await seedUser(clinicId, "owner");
    await createInvitedUser(clinicId, owner, { name: "A", email: "taken@clinic.lk", role: "staff", passwordHash: "h" });
    expect(await emailExists("taken@clinic.lk")).toBe(true);
    expect(await emailExists("free@clinic.lk")).toBe(false);
  });

  it("lists a clinic's users by name and stays tenant-scoped", async () => {
    const clinicId = await seedClinic();
    const owner = await seedUser(clinicId, "owner"); // name "Tester"
    await createInvitedUser(clinicId, owner, { name: "Anna", email: "a@clinic.lk", role: "staff", passwordHash: "h" });
    const other = await seedClinic();
    await seedUser(other, "owner");

    const list = await listClinicUsers(clinicId);
    expect(list.map((u) => u.name)).toEqual(["Anna", "Tester"]); // name order
    expect(list.every((u) => u.email !== undefined)).toBe(true);
  });
});
