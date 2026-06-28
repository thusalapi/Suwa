import { describe, it, expect, beforeEach } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import {
  createTemplate,
  updateTemplate,
  setTemplateActive,
  getTemplate,
  listTemplates,
} from "@/lib/report-templates";
import { fbcTemplate } from "@/lib/report-engine/examples";
import { resetDb, seedClinic, seedUser } from "./helpers";

beforeEach(resetDb);

async function ctx() {
  const clinicId = await seedClinic();
  const userId = await seedUser(clinicId, "owner");
  return { clinicId, userId };
}

describe("createTemplate", () => {
  it("creates a v1 template, parses its schema, and audits it", async () => {
    const { clinicId, userId } = await ctx();
    const id = await createTemplate(clinicId, userId, fbcTemplate);

    const tpl = await getTemplate(clinicId, id);
    expect(tpl).toMatchObject({ name: "Full Blood Count", version: 1, active: true });
    expect(tpl!.schema.sections.length).toBe(fbcTemplate.sections.length);

    const list = await listTemplates(clinicId);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: "Full Blood Count", sectionCount: fbcTemplate.sections.length });

    const audit = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityId, id), eq(auditLogs.action, "template.create")));
    expect(audit).toHaveLength(1);
  });

  it("forces version to 1 even if the input says otherwise", async () => {
    const { clinicId, userId } = await ctx();
    const id = await createTemplate(clinicId, userId, { ...fbcTemplate, version: 9 });
    expect((await getTemplate(clinicId, id))!.version).toBe(1);
  });
});

describe("updateTemplate", () => {
  it("bumps the version, updates the schema, and audits it", async () => {
    const { clinicId, userId } = await ctx();
    const id = await createTemplate(clinicId, userId, fbcTemplate);

    const v = await updateTemplate(clinicId, userId, id, { ...fbcTemplate, name: "FBC v2" });
    expect(v).toBe(2);

    const tpl = await getTemplate(clinicId, id);
    expect(tpl).toMatchObject({ name: "FBC v2", version: 2 });

    const audit = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityId, id), eq(auditLogs.action, "template.update")));
    expect(audit).toHaveLength(1);
  });
});

describe("setTemplateActive", () => {
  it("soft toggles active with matching audit actions", async () => {
    const { clinicId, userId } = await ctx();
    const id = await createTemplate(clinicId, userId, fbcTemplate);

    await setTemplateActive(clinicId, userId, id, false);
    expect((await getTemplate(clinicId, id))!.active).toBe(false);
    await setTemplateActive(clinicId, userId, id, true);
    expect((await getTemplate(clinicId, id))!.active).toBe(true);

    const actions = (
      await db.select({ action: auditLogs.action }).from(auditLogs).where(eq(auditLogs.entityId, id))
    ).map((r) => r.action);
    expect(actions).toContain("template.deactivate");
    expect(actions).toContain("template.activate");
  });
});

describe("tenant scope", () => {
  it("won't read or update another clinic's template", async () => {
    const a = await ctx();
    const b = await ctx();
    const id = await createTemplate(a.clinicId, a.userId, fbcTemplate);
    expect(await getTemplate(b.clinicId, id)).toBeNull();
    expect(await listTemplates(b.clinicId)).toHaveLength(0);
  });
});
