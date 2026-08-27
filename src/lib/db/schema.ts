/**
 * Drizzle schema — typed query/table definitions mirroring docs/data-model.md.
 *
 * IMPORTANT: Drizzle is used for typed queries only. The migration source of truth is
 * Liquibase (liquibase/changelog). When the schema changes, add a Liquibase changeset AND
 * update this file so types and DDL stay in agreement. Never run drizzle-kit migrations.
 *
 * Conventions (see docs + .claude/skills/suwa-backend):
 *  - Money is integer minor units (LKR cents). No floats.
 *  - Every domain table carries clinic_id; every query filters by it.
 *  - Financial/clinical rows use status, never hard-delete.
 *  - JSONB for flexible structure; real columns for queryable facts.
 */
import { pgTable, uuid, text, integer, boolean, date, timestamp, jsonb, unique, index } from "drizzle-orm/pg-core";

const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export type UserRole = "owner" | "staff" | "doctor";
export type BillStatus = "draft" | "finalized" | "paid" | "cancelled";
export type ReportStatus = "draft" | "finalized" | "verified";
export type PaymentMethod = "cash" | "card" | "bank" | "other";

/** The tenant. One per customer account at MVP; clinic_id everywhere enables SaaS later. */
export const clinics = pgTable("clinics", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  address: text("address"),
  phone: text("phone"),
  fax: text("fax"),
  email: text("email"),
  logoUrl: text("logo_url"),
  currency: text("currency").notNull().default("LKR"),
  taxRate: integer("tax_rate").notNull().default(0), // basis points, e.g. 800 = 8.00%
  showReportQr: boolean("show_report_qr").notNull().default(true), // QR (report no.) on report PDFs
  createdAt,
});

/** Self-hosted credentials auth — password hash lives here, no external IdP. */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    role: text("role").$type<UserRole>().notNull(),
    passwordHash: text("password_hash").notNull(),
    mustReset: boolean("must_reset").notNull().default(true),
    createdAt,
  },
  (t) => [index("users_clinic_idx").on(t.clinicId)],
);

/** Shared backbone. Phone is the lookup key (unique per clinic); NIC is optional. */
export const patients = pgTable(
  "patients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    fullName: text("full_name").notNull(),
    phone: text("phone").notNull(),
    nic: text("nic"),
    gender: text("gender"),
    dob: date("dob"),
    address: text("address"),
    notes: text("notes"),
    createdAt,
  },
  (t) => [unique("patients_clinic_phone_key").on(t.clinicId, t.phone), index("patients_clinic_idx").on(t.clinicId)],
);

/** Price catalog. default_price is integer minor units. */
export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    name: text("name").notNull(),
    defaultPrice: integer("default_price").notNull(),
    category: text("category"),
    active: boolean("active").notNull().default(true),
  },
  (t) => [index("services_clinic_idx").on(t.clinicId)],
);

export const bills = pgTable(
  "bills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    billNumber: integer("bill_number").notNull(), // sequential per clinic, gap-free
    status: text("status").$type<BillStatus>().notNull().default("draft"),
    subtotal: integer("subtotal").notNull().default(0),
    discount: integer("discount").notNull().default(0),
    tax: integer("tax").notNull().default(0),
    total: integer("total").notNull().default(0),
    amountPaid: integer("amount_paid").notNull().default(0),
    balance: integer("balance").notNull().default(0),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt,
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
  },
  (t) => [
    unique("bills_clinic_number_key").on(t.clinicId, t.billNumber),
    index("bills_clinic_idx").on(t.clinicId),
    index("bills_patient_idx").on(t.patientId),
  ],
);

/** Price + description snapshotted so catalog edits never alter past bills. */
export const billItems = pgTable(
  "bill_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billId: uuid("bill_id")
      .notNull()
      .references(() => bills.id),
    serviceId: uuid("service_id").references(() => services.id), // null for free-text lines
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPrice: integer("unit_price").notNull(), // snapshot, minor units
    lineTotal: integer("line_total").notNull(),
  },
  (t) => [index("bill_items_bill_idx").on(t.billId)],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    billId: uuid("bill_id")
      .notNull()
      .references(() => bills.id),
    amount: integer("amount").notNull(), // minor units
    method: text("method").$type<PaymentMethod>().notNull(),
    receivedBy: uuid("received_by")
      .notNull()
      .references(() => users.id),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payments_bill_idx").on(t.billId)],
);

/** Defines a report type via a JSON schema (see docs/report-engine.md). */
export const reportTemplates = pgTable(
  "report_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    name: text("name").notNull(),
    version: integer("version").notNull().default(1),
    schema: jsonb("schema").notNull(),
    active: boolean("active").notNull().default(true),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt,
  },
  (t) => [index("report_templates_clinic_idx").on(t.clinicId)],
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    templateId: uuid("template_id")
      .notNull()
      .references(() => reportTemplates.id),
    reportNumber: integer("report_number").notNull(), // sequential per clinic, gap-free
    templateSnapshot: jsonb("template_snapshot").notNull(), // FROZEN schema at creation
    data: jsonb("data").notNull(),
    status: text("status").$type<ReportStatus>().notNull().default("draft"),
    verifiedBy: uuid("verified_by").references(() => users.id),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    pdfUrl: text("pdf_url"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt,
  },
  (t) => [
    unique("reports_clinic_number_key").on(t.clinicId, t.reportNumber),
    index("reports_clinic_idx").on(t.clinicId),
    index("reports_patient_idx").on(t.patientId),
  ],
);

/** Append-only audit trail, written in the same transaction as the change it records. */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clinicId: uuid("clinic_id")
      .notNull()
      .references(() => clinics.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    action: text("action").notNull(), // e.g. "bill.create", "report.verify"
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    metadata: jsonb("metadata"),
    createdAt,
  },
  (t) => [index("audit_logs_clinic_idx").on(t.clinicId)],
);
