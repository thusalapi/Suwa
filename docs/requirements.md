# System Requirements

## 1. Vision

A SaaS that lets a small medical / diagnostic center manage patients, bill them, and
generate professional lab reports — where the center can define its **own** report
types without developer help.

## 2. Target users & roles

| Role | Description | Can do |
|------|-------------|--------|
| **Owner** | Runs the center | Everything: settings, staff, billing, reports, view all financials |
| **Staff** (front desk / MLT) | Day-to-day operations | Register patients, create bills, take payments, enter report data |
| **Doctor / Verifier** | Clinical sign-off | Review and **verify** reports before release; add interpretation |

Roles are enforced on every API route, not just hidden in the UI.

## 3. Scope

### In scope (MVP)
- Patient registry (shared by billing and reports)
- Service / price catalog
- Billing: itemized bills, discounts, tax, partial payments
- Branded PDF invoices (A4) and **80 mm POS receipts**; bills carry their date and time
- Report engine (JSON-schema driven):
  - The clinic's own report types as **locked system templates** (23 at the pilot), plus a
    visual builder for clinic-made templates
  - Auto-generated data-entry forms from a template, with a searchable report picker
  - Results tables with units + reference ranges + **auto High/Low/Critical flagging**
  - **Calculated results** (eGFR, LDL/VLDL, absolute counts, RBC indices, globulin, A/G,
    mmol/l…) from formulas, using the patient's age and sex where needed
  - Doctor verification / sign-off before release
  - Branded PDF reports with report number
- Patient **visits**: reports and bills grouped by the day the patient came in
- Dashboard: today's revenue, bills, pending reports, outstanding balances
- Reports/exports: revenue by date range, breakdown by service, outstanding payments (PDF/CSV)
- Audit log of who created / edited / verified bills and reports
- Authentication with role-based access

### Out of scope (deliberately deferred)
- Appointments / scheduling
- Prescriptions
- Full electronic medical records / diagnoses history
- Inventory management
- SMS reminders
- Insurance claims
- Multi-branch
- Age/gender-specific reference **ranges** (formulas already use age and sex; ranges are
  still one per row — sex/age ranges are printed as text, e.g. ESR)

## 4. Functional requirements

### 4.1 Patients
- Add, search, edit patients (name, phone, gender, DOB **or age** if the birth date is
  unknown, address optional, notes)
- View a patient's full history grouped into **visits** (reports + bills per day)
- Minimal PII at MVP; no clinical diagnosis storage in v1

### 4.2 Billing
- Create a bill linked to a patient
- Add line items from the catalog or as free text
- Snapshot the price/description onto the line item (catalog changes don't alter past bills)
- Apply discount and tax; auto-calculate subtotal and total
- Record full or partial payments with method (cash / card / bank / other)
- Gap-free sequential **bill number** per clinic
- Generate a branded A4 invoice / receipt PDF and an 80 mm POS receipt
- Bills are never hard-deleted — use status (`draft|finalized|paid|cancelled`)

### 4.3 Report engine
- A template defines sections/blocks via a JSON schema (see report-engine.md)
- Creating a report from a template auto-generates the data-entry form
- `results_table` blocks compute a flag (Normal / High / Low / Critical) per row; rows can be
  **calculated** by formula (never typed)
- The specimen Date & Time defaults to now
- A report must be **verified** by a doctor/verifier before it is finalized/released
- Each report freezes a **snapshot** of the template schema used (reproducibility)
- Generate a branded PDF with a unique report number (and optional QR code)
- Reports are never hard-deleted — use status (`draft|finalized|verified`)

### 4.4 Dashboard & reporting
- Owner dashboard: revenue today, bills today, pending (unverified) reports, outstanding balances
- Date-range revenue report; breakdown by service; outstanding payments list
- Export to PDF and CSV

## 5. Non-functional requirements

| Area | Requirement |
|------|-------------|
| **Security** | HTTPS in production; hashed passwords; role checks on every API route |
| **Auditability** | Every create/edit/verify on bills and reports logged with user + timestamp |
| **Reproducibility** | Bills and reports re-render exactly as issued, forever |
| **Data safety** | Automated database backups enabled from day one |
| **Integrity** | Money stored as integers (cents); gap-free sequential numbering |
| **Privacy** | Holding clinical + financial data — least-privilege access; no hard deletes |
| **Performance** | Bill/report creation and PDF generation feel instant (< ~2s) |
| **Usability** | Front-desk staff can create a bill or report in well under a minute |

## 6. Assumptions & open questions

- Currency and tax rate are per-clinic settings (single currency at MVP).
- Single-clinic per account at MVP (multi-branch deferred).
- **Resolved:** the pilot clinic's report types were captured from its printed reports and
  built as 23 locked templates. Open points on calculations (RBC estimate, rounding vs cut-off,
  limits exactly on a "<" range) are being confirmed with the clinic.
- **Resolved:** receipts print on 80 mm POS paper; A4 invoices remain available.
- **Open:** production hosting and data-residency obligations — see production-plan.md.
