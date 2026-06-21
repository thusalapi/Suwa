import "server-only";
import { db, type Executor } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

/**
 * Append-only audit trail. Every create/edit/verify on bills/reports (and security events
 * like login) records one row. When recording the change and its audit together, pass the
 * SAME transaction handle so they commit or roll back as a unit — if the audit can't be
 * written, the change must not stand (see suwa-backend "Mutations — the standard shape").
 */
export interface AuditEntry {
  clinicId: string;
  userId: string;
  /** Dotted verb, e.g. "auth.login", "bill.create", "report.verify". */
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

/** Write one audit row. Pass a `tx` to bind it to a surrounding transaction. */
export async function recordAudit(entry: AuditEntry, exec: Executor = db): Promise<void> {
  await exec.insert(auditLogs).values({
    clinicId: entry.clinicId,
    userId: entry.userId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    metadata: entry.metadata ?? null,
  });
}
