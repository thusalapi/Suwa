# Data Model

PostgreSQL. Money is stored as **integers** (smallest currency unit). Financial and
clinical records are **never hard-deleted** — they use status fields. JSON columns use
**JSONB**.

## Entity overview

```
clinics ──┬── users
          ├── patients ──┬── bills ── bill_items
          │              │         └── payments
          │              └── reports
          ├── services
          ├── report_templates ── reports
          └── audit_logs
```

## Tables

### clinics
The tenant. One per customer account at MVP.
```
id              uuid pk
name            text
address         text
phone           text
fax             text          -- shown in the report PDF header (Tel/Fax/Email)
email           text          -- shown in the report PDF header
logo_url        text
currency        text          -- e.g. "LKR"
tax_rate        integer       -- basis points, e.g. 800 = 8.00%
show_report_qr  boolean       -- QR (report number) on report PDFs; default true
created_at      timestamptz
```

### users
```
id              uuid pk
clinic_id       uuid fk -> clinics
name            text
email           text unique
role            text          -- owner | staff | doctor
password_hash   text          -- argon2/bcrypt; self-hosted auth, no external provider
must_reset      boolean       -- true for invited accounts until first-login password set
created_at      timestamptz
```
The first owner row is created by the one-time setup script; staff/doctor rows are
created by the owner from settings and set their password on first login.

### patients
Shared backbone for billing and reports. Minimal PII at MVP.
**Phone number is the lookup key** — staff find and dedupe patients by phone.
**NIC is optional.**
```
id              uuid pk
clinic_id       uuid fk -> clinics
full_name       text
phone           text          -- primary lookup key; required
nic             text          nullable  -- national ID, optional
gender          text          -- male | female | other
dob             date          nullable
address         text          nullable
notes           text          nullable
created_at      timestamptz
unique (clinic_id, phone)
```

### services  (price catalog)
```
id              uuid pk
clinic_id       uuid fk -> clinics
name            text
default_price   integer       -- cents
category        text          nullable
active          boolean
```

### bills
```
id              uuid pk
clinic_id       uuid fk -> clinics
patient_id      uuid fk -> patients
bill_number     integer       -- sequential per clinic, gap-free
status          text          -- draft | finalized | paid | cancelled
subtotal        integer
discount        integer
tax             integer
total           integer
amount_paid     integer
balance         integer
created_by      uuid fk -> users
created_at      timestamptz
finalized_at    timestamptz   nullable
unique (clinic_id, bill_number)
```

### bill_items
Price + description are **snapshotted** here so catalog changes never alter past bills.
```
id              uuid pk
bill_id         uuid fk -> bills
service_id      uuid fk -> services   nullable  -- null for free-text lines
description     text          -- snapshot of the service name / free text
quantity        integer
unit_price      integer       -- snapshot, cents
line_total      integer
```

### payments
```
id              uuid pk
bill_id         uuid fk -> bills
amount          integer       -- cents
method          text          -- cash | card | bank | other
received_by     uuid fk -> users
received_at     timestamptz
```

### report_templates
Defines a report type via a JSON schema (see report-engine.md).
```
id              uuid pk
clinic_id       uuid fk -> clinics
name            text          -- e.g. "Full Blood Count"
version         integer       -- bumped on edit
schema          jsonb         -- the template definition
active          boolean
created_by      uuid fk -> users
created_at      timestamptz
```

### reports
```
id                uuid pk
clinic_id         uuid fk -> clinics
patient_id        uuid fk -> patients
template_id       uuid fk -> report_templates
report_number     integer     -- sequential per clinic, gap-free
template_snapshot jsonb       -- FROZEN copy of the schema at creation
data              jsonb       -- the filled-in values
status            text        -- draft | finalized | verified
verified_by       uuid fk -> users  nullable
verified_at       timestamptz nullable
pdf_url           text        nullable
created_by        uuid fk -> users
created_at        timestamptz
unique (clinic_id, report_number)
```

### audit_logs
```
id              uuid pk
clinic_id       uuid fk -> clinics
user_id         uuid fk -> users
action          text          -- e.g. "bill.create", "report.verify"
entity_type     text          -- bill | report | patient | template | ...
entity_id       uuid
metadata        jsonb         nullable
created_at      timestamptz
```

## Key design decisions

1. **Snapshotting over referencing.** Bills snapshot price/description onto
   `bill_items`; reports freeze `template_snapshot`. Past records are immutable in
   appearance even after catalog/template edits. This is the backbone of
   reproducibility.

2. **Status, never delete.** Financial and clinical rows use status fields. No hard
   deletes — cancellations are a state, preserving the audit trail.

3. **Integer money.** All amounts in the smallest currency unit. No floats.

4. **Gap-free sequential numbers.** `bill_number` / `report_number` per clinic,
   generated atomically. Clinics rely on clean numbering for their own accounting.

5. **JSONB for flexible structure, columns for queryable facts.** Template schemas and
   report data live in JSONB; money, status, dates, and foreign keys stay as real
   columns so dashboards and reports query fast.

6. **Tenant isolation.** Every domain table carries `clinic_id`; every query filters by
   it. (Consider Postgres RLS later for defense in depth.)

7. **Audit in-transaction.** The audit row is written in the same DB transaction as the
   change it records, so they can never drift apart.

8. **Phone is the patient lookup key.** UUID stays the internal PK, but `phone` is unique
   per clinic and is how staff search and dedupe patients. `nic` is optional metadata,
   never required to register a patient.

9. **Self-hosted credentials.** No external identity provider — `users.password_hash`
   holds an argon2/bcrypt hash; sessions are server-side, role checks server-side.
