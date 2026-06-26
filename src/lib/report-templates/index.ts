import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reportTemplates } from "@/lib/db/schema";
import { recordAudit } from "@/lib/audit";
import { parseTemplate, type Template } from "@/lib/report-engine";

/** Row shape for the templates list. */
export interface TemplateListItem {
  id: string;
  name: string;
  version: number;
  active: boolean;
  sectionCount: number;
}

/** A stored template with its parsed schema. */
export interface StoredTemplate {
  id: string;
  name: string;
  version: number;
  active: boolean;
  schema: Template;
}

/** List a clinic's templates (newest first). Tenant-scoped. */
export async function listTemplates(clinicId: string): Promise<TemplateListItem[]> {
  const rows = await db
    .select({
      id: reportTemplates.id,
      name: reportTemplates.name,
      version: reportTemplates.version,
      active: reportTemplates.active,
      schema: reportTemplates.schema,
    })
    .from(reportTemplates)
    .where(eq(reportTemplates.clinicId, clinicId))
    .orderBy(desc(reportTemplates.createdAt));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    version: r.version,
    active: r.active,
    sectionCount: Array.isArray((r.schema as Template)?.sections) ? (r.schema as Template).sections.length : 0,
  }));
}

/** Load one template (tenant-scoped) with its schema parsed/validated, or null. */
export async function getTemplate(clinicId: string, id: string): Promise<StoredTemplate | null> {
  const [row] = await db
    .select({
      id: reportTemplates.id,
      name: reportTemplates.name,
      version: reportTemplates.version,
      active: reportTemplates.active,
      schema: reportTemplates.schema,
    })
    .from(reportTemplates)
    .where(and(eq(reportTemplates.clinicId, clinicId), eq(reportTemplates.id, id)))
    .limit(1);
  if (!row) return null;
  return { ...row, schema: parseTemplate(row.schema) };
}

/**
 * Create a template. Version starts at 1; the stored schema's name/version are synced to the
 * row so the JSONB stays self-consistent (snapshots read name/version from the schema).
 */
export async function createTemplate(clinicId: string, userId: string, template: Template): Promise<string> {
  const schema: Template = { ...template, version: 1 };
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(reportTemplates)
      .values({ clinicId, name: schema.name, version: 1, schema, createdBy: userId })
      .returning({ id: reportTemplates.id });

    await recordAudit(
      {
        clinicId,
        userId,
        action: "template.create",
        entityType: "template",
        entityId: row.id,
        metadata: { version: 1 },
      },
      tx,
    );
    return row.id;
  });
}

/**
 * Update a template, bumping its version. Already-issued reports are unaffected — they keep
 * the snapshot frozen at creation (docs/report-engine.md). Returns the new version.
 */
export async function updateTemplate(
  clinicId: string,
  userId: string,
  id: string,
  template: Template,
): Promise<number> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ version: reportTemplates.version })
      .from(reportTemplates)
      .where(and(eq(reportTemplates.id, id), eq(reportTemplates.clinicId, clinicId)))
      .limit(1);
    if (!current) throw new Error("Template not found.");

    const nextVersion = current.version + 1;
    const schema: Template = { ...template, version: nextVersion };

    await tx
      .update(reportTemplates)
      .set({ name: schema.name, version: nextVersion, schema })
      .where(and(eq(reportTemplates.id, id), eq(reportTemplates.clinicId, clinicId)));

    await recordAudit(
      {
        clinicId,
        userId,
        action: "template.update",
        entityType: "template",
        entityId: id,
        metadata: { version: nextVersion },
      },
      tx,
    );
    return nextVersion;
  });
}

/** Activate / deactivate a template (soft, never hard-delete). */
export async function setTemplateActive(clinicId: string, userId: string, id: string, active: boolean): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(reportTemplates)
      .set({ active })
      .where(and(eq(reportTemplates.id, id), eq(reportTemplates.clinicId, clinicId)));

    await recordAudit(
      {
        clinicId,
        userId,
        action: active ? "template.activate" : "template.deactivate",
        entityType: "template",
        entityId: id,
      },
      tx,
    );
  });
}
