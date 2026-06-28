import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, type Tx } from "@/lib/db";
import { reports, patients, users, type ReportStatus } from "@/lib/db/schema";
import { recordAudit } from "@/lib/audit";
import { getTemplate } from "@/lib/report-templates";
import { computeResults, validateReportData, type Template, type ReportData } from "@/lib/report-engine";

/** Raw, stringy entry from the form. The service coerces it against the template snapshot. */
export interface CreateReportInput {
  patientId: string;
  templateId: string;
  /** patient_info field key → raw string. */
  patientInfo: Record<string, string>;
  /** results_table row key → raw numeric string. */
  results: Record<string, string>;
  /** field/textarea key → raw string. */
  values: Record<string, string>;
}

export class ReportValidationError extends Error {}

/** Row shape for report lists (patient detail, reports index). */
export interface ReportListItem {
  id: string;
  reportNumber: number;
  status: ReportStatus;
  templateName: string;
  patientName: string;
  createdAt: Date;
}

/** A full report for the view/PDF: frozen snapshot + entered data + related names. */
export interface ReportDetail {
  id: string;
  reportNumber: number;
  status: ReportStatus;
  patientId: string;
  patientName: string;
  snapshot: Template;
  data: ReportData;
  verifiedByName: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
}

/**
 * Allocate the next gap-free report number for a clinic. A per-clinic transaction advisory
 * lock serialises concurrent inserts so numbers never collide or skip (see suwa-backend
 * "Sequential numbering").
 */
async function nextReportNumber(tx: Tx, clinicId: string): Promise<number> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${clinicId}))`);
  const [row] = await tx
    .select({ max: sql<number>`coalesce(max(${reports.reportNumber}), 0)` })
    .from(reports)
    .where(eq(reports.clinicId, clinicId));
  return Number(row?.max ?? 0) + 1;
}

/** Coerce raw form strings into typed ReportData using the template snapshot. */
function buildData(snapshot: Template, input: CreateReportInput): ReportData {
  const data: ReportData = {};

  const patientInfoSection = snapshot.sections.find((s) => s.type === "patient_info");
  if (patientInfoSection) {
    const pi: Record<string, string | number> = {};
    for (const f of patientInfoSection.fields) {
      const raw = input.patientInfo[f]?.trim();
      if (!raw) continue;
      pi[f] = f === "age" ? Number(raw) : raw;
    }
    if (Object.keys(pi).length) data.patient_info = pi;
  }

  const resultValues: Record<string, number> = {};
  for (const [key, raw] of Object.entries(input.results)) {
    const trimmed = raw?.trim();
    if (trimmed) resultValues[key] = Number(trimmed);
  }
  const results = computeResults(snapshot, resultValues);
  if (Object.keys(results).length) data.results = results;

  for (const s of snapshot.sections) {
    if (s.type === "field") {
      const raw = input.values[s.key]?.trim();
      if (raw === undefined || raw === "") continue;
      data[s.key] = s.inputType === "number" ? Number(raw) : raw;
    } else if (s.type === "textarea") {
      const raw = input.values[s.key];
      if (raw !== undefined && raw !== "") data[s.key] = raw;
    }
  }

  return data;
}

/**
 * Create a report as a draft. Freezes the full template schema into `template_snapshot`,
 * validates the entered data against it, computes + stores result flags, and allocates a
 * gap-free report number. Change + `report.create` audit commit in one transaction.
 */
export async function createReport(
  clinicId: string,
  userId: string,
  input: CreateReportInput,
): Promise<{ id: string; reportNumber: number }> {
  const template = await getTemplate(clinicId, input.templateId);
  if (!template) throw new ReportValidationError("Template not found.");

  const snapshot = template.schema;
  const data = buildData(snapshot, input);

  const parsed = validateReportData(snapshot, data);
  if (!parsed.success) {
    throw new ReportValidationError(parsed.error.issues[0]?.message ?? "Invalid report data.");
  }

  return db.transaction(async (tx) => {
    const reportNumber = await nextReportNumber(tx, clinicId);
    const [row] = await tx
      .insert(reports)
      .values({
        clinicId,
        patientId: input.patientId,
        templateId: input.templateId,
        reportNumber,
        templateSnapshot: snapshot,
        data: parsed.data,
        status: "draft",
        createdBy: userId,
      })
      .returning({ id: reports.id });

    await recordAudit(
      { clinicId, userId, action: "report.create", entityType: "report", entityId: row.id, metadata: { reportNumber } },
      tx,
    );
    return { id: row.id, reportNumber };
  });
}

/**
 * Update a draft report's entered data. The frozen `template_snapshot` is NEVER touched, so the
 * report stays reproducible — the new data is re-validated and re-flagged against the original
 * snapshot. A verified report is the released artifact and is immutable (refuses the edit).
 * Change + `report.update` audit commit in one transaction.
 */
export async function updateReport(
  clinicId: string,
  userId: string,
  id: string,
  input: CreateReportInput,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ status: reports.status, snapshot: reports.templateSnapshot })
      .from(reports)
      .where(and(eq(reports.id, id), eq(reports.clinicId, clinicId)))
      .limit(1);
    if (!existing) throw new ReportValidationError("Report not found.");
    if (existing.status === "verified") throw new ReportValidationError("A verified report can’t be edited.");

    const snapshot = existing.snapshot as Template;
    const data = buildData(snapshot, input);

    const parsed = validateReportData(snapshot, data);
    if (!parsed.success) {
      throw new ReportValidationError(parsed.error.issues[0]?.message ?? "Invalid report data.");
    }

    await tx
      .update(reports)
      .set({ data: parsed.data })
      .where(and(eq(reports.id, id), eq(reports.clinicId, clinicId)));

    await recordAudit({ clinicId, userId, action: "report.update", entityType: "report", entityId: id }, tx);
  });
}

/**
 * Doctor/owner sign-off: mark a report verified (idempotent). A verified report is the
 * released artifact — only after this should its PDF be issued (docs/roadmap.md non-negotiable).
 */
export async function verifyReport(clinicId: string, userId: string, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ status: reports.status })
      .from(reports)
      .where(and(eq(reports.id, id), eq(reports.clinicId, clinicId)))
      .limit(1);
    if (!row) throw new ReportValidationError("Report not found.");
    if (row.status === "verified") return;

    await tx
      .update(reports)
      .set({ status: "verified", verifiedBy: userId, verifiedAt: new Date() })
      .where(and(eq(reports.id, id), eq(reports.clinicId, clinicId)));

    await recordAudit({ clinicId, userId, action: "report.verify", entityType: "report", entityId: id }, tx);
  });
}

/** List reports in a clinic, optionally filtered to one patient. Newest first, tenant-scoped. */
export async function listReports(clinicId: string, patientId?: string): Promise<ReportListItem[]> {
  const where = patientId
    ? and(eq(reports.clinicId, clinicId), eq(reports.patientId, patientId))
    : eq(reports.clinicId, clinicId);

  const rows = await db
    .select({
      id: reports.id,
      reportNumber: reports.reportNumber,
      status: reports.status,
      snapshot: reports.templateSnapshot,
      patientName: patients.fullName,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .innerJoin(patients, eq(reports.patientId, patients.id))
    .where(where)
    .orderBy(desc(reports.reportNumber))
    .limit(100);

  return rows.map((r) => ({
    id: r.id,
    reportNumber: r.reportNumber,
    status: r.status,
    templateName: (r.snapshot as Template)?.name ?? "—",
    patientName: r.patientName,
    createdAt: r.createdAt,
  }));
}

/** Load one report (tenant-scoped) with snapshot, data, and related names. */
export async function getReport(clinicId: string, id: string): Promise<ReportDetail | null> {
  const [row] = await db
    .select({
      id: reports.id,
      reportNumber: reports.reportNumber,
      status: reports.status,
      patientId: reports.patientId,
      patientName: patients.fullName,
      snapshot: reports.templateSnapshot,
      data: reports.data,
      verifiedByName: users.name,
      verifiedAt: reports.verifiedAt,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .innerJoin(patients, eq(reports.patientId, patients.id))
    .leftJoin(users, eq(reports.verifiedBy, users.id))
    .where(and(eq(reports.clinicId, clinicId), eq(reports.id, id)))
    .limit(1);
  if (!row) return null;

  return {
    id: row.id,
    reportNumber: row.reportNumber,
    status: row.status,
    patientId: row.patientId,
    patientName: row.patientName,
    snapshot: row.snapshot as Template,
    data: row.data as ReportData,
    verifiedByName: row.verifiedByName,
    verifiedAt: row.verifiedAt,
    createdAt: row.createdAt,
  };
}
