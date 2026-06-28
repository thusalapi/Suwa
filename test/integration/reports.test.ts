import { describe, it, expect, beforeEach } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { createReport, updateReport, verifyReport, getReport, listReports, ReportValidationError } from "@/lib/reports";
import { createTemplate, updateTemplate } from "@/lib/report-templates";
import { fbcTemplate } from "@/lib/report-engine/examples";
import { resetDb, seedClinic, seedUser, seedPatient } from "./helpers";

beforeEach(resetDb);

async function ctx() {
  const clinicId = await seedClinic();
  const userId = await seedUser(clinicId, "doctor");
  const patientId = await seedPatient(clinicId);
  const templateId = await createTemplate(clinicId, userId, fbcTemplate);
  return { clinicId, userId, patientId, templateId };
}

const entry = (results: Record<string, string>) => ({
  patientInfo: { name: "Nimal", age: "65", gender: "male", ref_doctor: "" },
  results,
  values: { comments: "Routine" },
});

describe("createReport", () => {
  it("allocates gap-free report numbers per clinic", async () => {
    const { clinicId, userId, patientId, templateId } = await ctx();
    const a = await createReport(clinicId, userId, { patientId, templateId, ...entry({ hb: "14" }) });
    const b = await createReport(clinicId, userId, { patientId, templateId, ...entry({ hb: "15" }) });
    expect(a.reportNumber).toBe(1);
    expect(b.reportNumber).toBe(2);
  });

  it("freezes the snapshot, stores computed flags, and audits it", async () => {
    const { clinicId, userId, patientId, templateId } = await ctx();
    const { id } = await createReport(clinicId, userId, {
      patientId,
      templateId,
      ...entry({ hb: "10", wbc: "7", plt: "420" }),
    });

    const r = await getReport(clinicId, id);
    expect(r!.status).toBe("draft");
    expect(r!.snapshot.name).toBe("Full Blood Count"); // frozen copy
    // hb 10 < ref 13 → low; wbc 7 in 4–11 → normal; plt 420 > ref 410 → high.
    expect(r!.data.results).toMatchObject({
      hb: { value: 10, flag: "low" },
      wbc: { value: 7, flag: "normal" },
      plt: { value: 420, flag: "high" },
    });
    expect(r!.data.patient_info).toMatchObject({ name: "Nimal", age: 65 });

    const audit = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityId, id), eq(auditLogs.action, "report.create")));
    expect(audit).toHaveLength(1);
  });

  it("rejects invalid data (a non-numeric required structure) with ReportValidationError", async () => {
    const { clinicId, userId, patientId, templateId } = await ctx();
    // age must be numeric in the patient_info schema; a non-numeric string fails validation.
    await expect(
      createReport(clinicId, userId, {
        patientId,
        templateId,
        patientInfo: { name: "X", age: "not-a-number", gender: "male", ref_doctor: "" },
        results: {},
        values: {},
      }),
    ).rejects.toBeInstanceOf(ReportValidationError);
  });
});

describe("verifyReport", () => {
  it("marks verified with verifier + timestamp, audits it, and is idempotent", async () => {
    const { clinicId, userId, patientId, templateId } = await ctx();
    const { id } = await createReport(clinicId, userId, { patientId, templateId, ...entry({ hb: "14" }) });

    await verifyReport(clinicId, userId, id);
    let r = await getReport(clinicId, id);
    expect(r!.status).toBe("verified");
    expect(r!.verifiedByName).toBe("Tester");
    expect(r!.verifiedAt).toBeInstanceOf(Date);

    await verifyReport(clinicId, userId, id); // idempotent — no throw, no second audit
    r = await getReport(clinicId, id);
    expect(r!.status).toBe("verified");

    const audit = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityId, id), eq(auditLogs.action, "report.verify")));
    expect(audit).toHaveLength(1);
  });
});

describe("updateReport", () => {
  it("re-validates + re-flags a draft against the frozen snapshot and audits it", async () => {
    const { clinicId, userId, patientId, templateId } = await ctx();
    const { id } = await createReport(clinicId, userId, { patientId, templateId, ...entry({ hb: "10" }) });

    await updateReport(clinicId, userId, id, { patientId, templateId, ...entry({ hb: "16" }) });
    const r = await getReport(clinicId, id);
    expect(r!.data.results).toMatchObject({ hb: { value: 16, flag: "normal" } }); // re-flagged

    const audit = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityId, id), eq(auditLogs.action, "report.update")));
    expect(audit).toHaveLength(1);
  });

  it("refuses to edit a verified report (immutable released artifact)", async () => {
    const { clinicId, userId, patientId, templateId } = await ctx();
    const { id } = await createReport(clinicId, userId, { patientId, templateId, ...entry({ hb: "14" }) });
    await verifyReport(clinicId, userId, id);
    await expect(
      updateReport(clinicId, userId, id, { patientId, templateId, ...entry({ hb: "9" }) }),
    ).rejects.toBeInstanceOf(ReportValidationError);
  });
});

describe("snapshot isolation", () => {
  it("keeps an issued report's frozen snapshot even after the template changes", async () => {
    const { clinicId, userId, patientId, templateId } = await ctx();
    const { id } = await createReport(clinicId, userId, { patientId, templateId, ...entry({ hb: "14" }) });

    await updateTemplate(clinicId, userId, templateId, { ...fbcTemplate, name: "Renamed FBC" });
    const r = await getReport(clinicId, id);
    expect(r!.snapshot.name).toBe("Full Blood Count"); // not "Renamed FBC"
  });
});

describe("listReports / tenant scope", () => {
  it("lists newest first, filters by patient, and never crosses clinics", async () => {
    const { clinicId, userId, patientId, templateId } = await ctx();
    const other = await ctx();
    await createReport(clinicId, userId, { patientId, templateId, ...entry({ hb: "14" }) });
    await createReport(clinicId, userId, { patientId, templateId, ...entry({ hb: "15" }) });

    const list = await listReports(clinicId);
    expect(list.map((r) => r.reportNumber)).toEqual([2, 1]); // newest first
    expect(await listReports(clinicId, patientId)).toHaveLength(2);
    expect(await listReports(other.clinicId)).toHaveLength(0);
  });
});
