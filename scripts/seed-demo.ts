/**
 * Seed a full, client-demo-ready dataset: services catalog, patients, itemized bills (paid /
 * partially paid / unpaid), and lab reports (verified + one left pending) — so a walkthrough
 * doesn't start from an empty app.
 *
 *   npm run seed:demo
 *
 * DESTRUCTIVE for demo data only: wipes this clinic's existing patients/bills/payments/reports/
 * services (not clinics, users, or report_templates) before reseeding, so it's safe to re-run
 * for a fresh demo. Mirrors scripts/seed-templates.ts: standalone connection (the "server-only"
 * lib/db client can't load outside the Next.js runtime), business logic (bill/report numbering,
 * totals, flagging) duplicated from src/lib/bills + src/lib/reports since those modules are
 * server-only too. The report-engine itself (src/lib/report-engine) is dependency-free and is
 * imported directly.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, sql } from "drizzle-orm";
import {
  clinics,
  users,
  services,
  patients,
  bills,
  billItems,
  payments,
  reportTemplates,
  reports,
  type PaymentMethod,
} from "../src/lib/db/schema";
import { fbcTemplate, fastingBloodSugarTemplate, bloodGroupingTemplate } from "../src/lib/report-engine/examples";
import { computeResults, validateReportData, type Template, type ReportData } from "../src/lib/report-engine";

process.loadEnvFile(".env");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("✗ DATABASE_URL is not set (see .env).");
  process.exit(1);
}

type Tx = Parameters<Parameters<ReturnType<typeof drizzle>["transaction"]>[0]>[0];

const rupees = (n: number) => Math.round(n * 100);

async function nextBillNumber(tx: Tx, clinicId: string): Promise<number> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${clinicId + ":bill"}))`);
  const [row] = await tx
    .select({ max: sql<number>`coalesce(max(${bills.billNumber}), 0)` })
    .from(bills)
    .where(eq(bills.clinicId, clinicId));
  return Number(row?.max ?? 0) + 1;
}

async function nextReportNumber(tx: Tx, clinicId: string): Promise<number> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${clinicId}))`);
  const [row] = await tx
    .select({ max: sql<number>`coalesce(max(${reports.reportNumber}), 0)` })
    .from(reports)
    .where(eq(reports.clinicId, clinicId));
  return Number(row?.max ?? 0) + 1;
}

interface DemoBillLine {
  serviceId: string;
  description: string;
  quantity: number;
  unitPrice: number; // minor units
}

interface DemoBillSpec {
  patientId: string;
  items: DemoBillLine[];
  /** minor units paid now, or undefined for no payment. */
  pay?: { amount: number; method: PaymentMethod };
}

async function seedBill(tx: Tx, clinicId: string, userId: string, spec: DemoBillSpec) {
  const lines = spec.items.map((i) => ({ ...i, lineTotal: i.quantity * i.unitPrice }));
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const total = subtotal; // no discount/tax in the demo set

  const billNumber = await nextBillNumber(tx, clinicId);
  const [bill] = await tx
    .insert(bills)
    .values({
      clinicId,
      patientId: spec.patientId,
      billNumber,
      status: "finalized",
      subtotal,
      discount: 0,
      tax: 0,
      total,
      amountPaid: 0,
      balance: total,
      createdBy: userId,
      finalizedAt: new Date(),
    })
    .returning({ id: bills.id });

  await tx.insert(billItems).values(
    lines.map((l) => ({
      billId: bill.id,
      serviceId: l.serviceId,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
    })),
  );

  if (spec.pay) {
    const amountPaid = spec.pay.amount;
    const balance = total - amountPaid;
    await tx
      .update(bills)
      .set({ amountPaid, balance, status: balance <= 0 ? "paid" : "finalized" })
      .where(eq(bills.id, bill.id));
    await tx.insert(payments).values({
      billId: bill.id,
      amount: spec.pay.amount,
      method: spec.pay.method,
      receivedBy: userId,
    });
  }

  return { id: bill.id, billNumber };
}

interface DemoReportSpec {
  patientId: string;
  template: { id: string; schema: Template };
  patientInfo: Record<string, string | number>;
  results: Record<string, string>;
  verified: boolean;
}

async function seedReport(tx: Tx, clinicId: string, userId: string, spec: DemoReportSpec) {
  const snapshot = spec.template.schema;
  const data: ReportData = {
    patient_info: spec.patientInfo,
    results: computeResults(snapshot, spec.results),
  };
  const parsed = validateReportData(snapshot, data);
  if (!parsed.success) {
    throw new Error(`Invalid demo report data for "${snapshot.name}": ${parsed.error.issues[0]?.message}`);
  }

  const reportNumber = await nextReportNumber(tx, clinicId);
  const [row] = await tx
    .insert(reports)
    .values({
      clinicId,
      patientId: spec.patientId,
      templateId: spec.template.id,
      reportNumber,
      templateSnapshot: snapshot,
      data: parsed.data,
      status: spec.verified ? "verified" : "draft",
      verifiedBy: spec.verified ? userId : null,
      verifiedAt: spec.verified ? new Date() : null,
      createdBy: userId,
    })
    .returning({ id: reports.id });

  return { id: row.id, reportNumber };
}

async function main() {
  const sql_ = postgres(databaseUrl!, { max: 1 });
  const db = drizzle(sql_);
  try {
    const [clinic] = await db.select({ id: clinics.id, name: clinics.name }).from(clinics).limit(1);
    if (!clinic) throw new Error("No clinic found — run `npm run seed:owner` first.");

    const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.clinicId, clinic.id)).limit(1);
    if (!owner) throw new Error(`No user found for clinic "${clinic.name}".`);

    console.log(`Resetting demo data for clinic "${clinic.name}"...`);
    await db.execute(sql`delete from payments using bills where payments.bill_id = bills.id and bills.clinic_id = ${clinic.id}`);
    await db.execute(sql`delete from bill_items using bills where bill_items.bill_id = bills.id and bills.clinic_id = ${clinic.id}`);
    await db.delete(bills).where(eq(bills.clinicId, clinic.id));
    await db.delete(reports).where(eq(reports.clinicId, clinic.id));
    await db.delete(patients).where(eq(patients.clinicId, clinic.id));
    await db.delete(services).where(eq(services.clinicId, clinic.id));

    // --- Templates: make sure Full Blood Count (table-style, shows live flag badges) exists
    // alongside the already-seeded Fasting Blood Sugar / Blood Grouping (list-style, no badge —
    // see docs/report-engine.md + ReportFormRenderer). Needed to demo auto-flagging visibly.
    const existingTemplates = await db
      .select({ id: reportTemplates.id, name: reportTemplates.name })
      .from(reportTemplates)
      .where(eq(reportTemplates.clinicId, clinic.id));
    const templateByName = new Map(existingTemplates.map((t) => [t.name, t.id]));

    for (const tpl of [fastingBloodSugarTemplate, bloodGroupingTemplate, fbcTemplate]) {
      if (templateByName.has(tpl.name)) continue;
      const [row] = await db
        .insert(reportTemplates)
        .values({ clinicId: clinic.id, name: tpl.name, version: 1, schema: tpl, createdBy: owner.id })
        .returning({ id: reportTemplates.id });
      templateByName.set(tpl.name, row.id);
      console.log(`+ template "${tpl.name}"`);
    }

    // --- Services (catalog) ---
    console.log("Seeding services...");
    const serviceSpecs = [
      { name: "Consultation", category: "Consultation", defaultPrice: rupees(1000) },
      { name: "Full Blood Count (FBC)", category: "Laboratory", defaultPrice: rupees(600) },
      { name: "Fasting Blood Sugar", category: "Laboratory", defaultPrice: rupees(500) },
      { name: "Blood Grouping & Rh", category: "Laboratory", defaultPrice: rupees(400) },
      { name: "Urine Full Report", category: "Laboratory", defaultPrice: rupees(450) },
      { name: "Lipid Profile", category: "Laboratory", defaultPrice: rupees(1200) },
      { name: "Liver Function Test", category: "Laboratory", defaultPrice: rupees(1500) },
      { name: "ECG", category: "Cardiology", defaultPrice: rupees(800) },
    ];
    const serviceRows = await db
      .insert(services)
      .values(serviceSpecs.map((s) => ({ clinicId: clinic.id, ...s })))
      .returning({ id: services.id, name: services.name });
    const serviceByName = new Map(serviceRows.map((s) => [s.name, s.id]));

    // --- Patients ---
    console.log("Seeding patients...");
    const patientSpecs = [
      { fullName: "Kamal Silva", phone: "0771234567", gender: "male", address: "Galle Rd, Colombo 03" },
      { fullName: "Nirosha Fernando", phone: "0712345678", gender: "female", address: "Temple Rd, Mount Lavinia" },
      { fullName: "Sunil Rathnayake", phone: "0767654321", gender: "male", address: "Main St, Kandy" },
      { fullName: "Dilani Jayawardena", phone: "0701122334", gender: "female", address: "Station Rd, Negombo" },
      { fullName: "Ruwan Bandara", phone: "0759988776", gender: "male", address: "Hill St, Matara" },
    ];
    const patientRows = await db
      .insert(patients)
      .values(patientSpecs.map((p) => ({ clinicId: clinic.id, ...p })))
      .returning({ id: patients.id, fullName: patients.fullName });
    const patientByName = new Map(patientRows.map((p) => [p.fullName, p.id]));
    const pid = (name: string) => {
      const id = patientByName.get(name);
      if (!id) throw new Error(`demo patient "${name}" missing`);
      return id;
    };
    const sid = (name: string) => {
      const id = serviceByName.get(name);
      if (!id) throw new Error(`demo service "${name}" missing`);
      return id;
    };

    // --- Bills ---
    console.log("Seeding bills...");
    await db.transaction(async (tx) => {
      await seedBill(tx, clinic.id, owner.id, {
        patientId: pid("Kamal Silva"),
        items: [
          { serviceId: sid("Consultation"), description: "Consultation", quantity: 1, unitPrice: rupees(1000) },
          {
            serviceId: sid("Full Blood Count (FBC)"),
            description: "Full Blood Count (FBC)",
            quantity: 1,
            unitPrice: rupees(600),
          },
        ],
        pay: { amount: rupees(1600), method: "cash" },
      });

      await seedBill(tx, clinic.id, owner.id, {
        patientId: pid("Nirosha Fernando"),
        items: [
          {
            serviceId: sid("Fasting Blood Sugar"),
            description: "Fasting Blood Sugar",
            quantity: 1,
            unitPrice: rupees(500),
          },
        ],
        pay: { amount: rupees(500), method: "card" },
      });

      await seedBill(tx, clinic.id, owner.id, {
        patientId: pid("Sunil Rathnayake"),
        items: [
          { serviceId: sid("Lipid Profile"), description: "Lipid Profile", quantity: 1, unitPrice: rupees(1200) },
          { serviceId: sid("Consultation"), description: "Consultation", quantity: 1, unitPrice: rupees(1000) },
        ],
        pay: { amount: rupees(1000), method: "cash" }, // partial — leaves LKR 1200 outstanding
      });

      await seedBill(tx, clinic.id, owner.id, {
        patientId: pid("Dilani Jayawardena"),
        items: [
          {
            serviceId: sid("Urine Full Report"),
            description: "Urine Full Report",
            quantity: 1,
            unitPrice: rupees(450),
          },
        ],
        // unpaid
      });

      await seedBill(tx, clinic.id, owner.id, {
        patientId: pid("Ruwan Bandara"),
        items: [
          { serviceId: sid("ECG"), description: "ECG", quantity: 1, unitPrice: rupees(800) },
          { serviceId: sid("Consultation"), description: "Consultation", quantity: 1, unitPrice: rupees(1000) },
        ],
        pay: { amount: rupees(1800), method: "bank" },
      });
    });

    // --- Reports ---
    console.log("Seeding reports...");
    const fbsId = templateByName.get("Fasting Blood Sugar")!;
    const fbcId = templateByName.get("Full Blood Count")!;
    const bloodGroupId = templateByName.get("Blood Grouping & Rh")!;

    await db.transaction(async (tx) => {
      await seedReport(tx, clinic.id, owner.id, {
        patientId: pid("Kamal Silva"),
        template: { id: fbsId, schema: fastingBloodSugarTemplate },
        patientInfo: {
          name: "Kamal Silva",
          age: 41,
          gender: "Male",
          referred_by: "Dr. S. Perera",
          specimen_no: "SP-1001",
          datetime: "2026-10-10T09:15",
          source: "Blood",
        },
        results: { fbs: "92" },
        verified: true,
      });

      // Deliberately abnormal WBC — Full Blood Count renders as a "table" style, so this is the
      // one that actually shows a live "High" flag badge (list-style templates don't render one).
      await seedReport(tx, clinic.id, owner.id, {
        patientId: pid("Nirosha Fernando"),
        template: { id: fbcId, schema: fbcTemplate },
        patientInfo: { name: "Nirosha Fernando", age: 29, gender: "Female", ref_doctor: "Dr. A. Jayasuriya" },
        results: { hb: "14.2", wbc: "12.1", plt: "250" },
        verified: true,
      });

      await seedReport(tx, clinic.id, owner.id, {
        patientId: pid("Dilani Jayawardena"),
        template: { id: fbsId, schema: fastingBloodSugarTemplate },
        patientInfo: {
          name: "Dilani Jayawardena",
          age: 35,
          gender: "Female",
          referred_by: "Dr. S. Perera",
          specimen_no: "SP-1002",
          datetime: "2026-10-10T10:00",
          source: "Blood",
        },
        results: { fbs: "98" },
        verified: true,
      });

      // Left as a draft on purpose — gives the demo a "pending verification" report to walk
      // through the doctor sign-off step live.
      await seedReport(tx, clinic.id, owner.id, {
        patientId: pid("Sunil Rathnayake"),
        template: { id: bloodGroupId, schema: bloodGroupingTemplate },
        patientInfo: { name: "Sunil Rathnayake", age: 52, gender: "Male", requested_by: "Dr. A. Jayasuriya", datetime: "2026-10-10T11:30" },
        results: { blood_group: "O Positive" },
        verified: false,
      });
    });

    console.log(`✓ Demo data seeded for clinic "${clinic.name}".`);
  } finally {
    await sql_.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(`✗ ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  });
