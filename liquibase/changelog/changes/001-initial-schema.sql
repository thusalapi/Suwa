--liquibase formatted sql

--changeset suwa:001-initial-schema
--comment: Initial Suwa schema — clinics, users, patients, services, billing, reports, audit.
-- Conventions: money is integer minor units (LKR cents); clinic_id on every domain table;
-- phone is the unique patient lookup key (NIC optional); bill/report numbers unique per clinic.

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

CREATE TABLE clinics (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  address     text,
  phone       text,
  logo_url    text,
  currency    text NOT NULL DEFAULT 'LKR',
  tax_rate    integer NOT NULL DEFAULT 0, -- basis points, e.g. 800 = 8.00%
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     uuid NOT NULL REFERENCES clinics(id),
  name          text NOT NULL,
  email         text NOT NULL UNIQUE,
  role          text NOT NULL, -- owner | staff | doctor
  password_hash text NOT NULL, -- self-hosted credentials (argon2/bcrypt), no external IdP
  must_reset    boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX users_clinic_idx ON users (clinic_id);

CREATE TABLE patients (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   uuid NOT NULL REFERENCES clinics(id),
  full_name   text NOT NULL,
  phone       text NOT NULL, -- lookup key
  nic         text,          -- optional national ID
  gender      text,          -- male | female | other
  dob         date,
  address     text,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patients_clinic_phone_key UNIQUE (clinic_id, phone)
);
CREATE INDEX patients_clinic_idx ON patients (clinic_id);

CREATE TABLE services (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     uuid NOT NULL REFERENCES clinics(id),
  name          text NOT NULL,
  default_price integer NOT NULL, -- minor units
  category      text,
  active        boolean NOT NULL DEFAULT true
);
CREATE INDEX services_clinic_idx ON services (clinic_id);

CREATE TABLE report_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   uuid NOT NULL REFERENCES clinics(id),
  name        text NOT NULL,
  version     integer NOT NULL DEFAULT 1,
  schema      jsonb NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  created_by  uuid NOT NULL REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX report_templates_clinic_idx ON report_templates (clinic_id);

CREATE TABLE bills (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     uuid NOT NULL REFERENCES clinics(id),
  patient_id    uuid NOT NULL REFERENCES patients(id),
  bill_number   integer NOT NULL, -- sequential per clinic, gap-free
  status        text NOT NULL DEFAULT 'draft', -- draft | finalized | paid | cancelled
  subtotal      integer NOT NULL DEFAULT 0,
  discount      integer NOT NULL DEFAULT 0,
  tax           integer NOT NULL DEFAULT 0,
  total         integer NOT NULL DEFAULT 0,
  amount_paid   integer NOT NULL DEFAULT 0,
  balance       integer NOT NULL DEFAULT 0,
  created_by    uuid NOT NULL REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  finalized_at  timestamptz,
  CONSTRAINT bills_clinic_number_key UNIQUE (clinic_id, bill_number)
);
CREATE INDEX bills_clinic_idx ON bills (clinic_id);
CREATE INDEX bills_patient_idx ON bills (patient_id);

CREATE TABLE bill_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id     uuid NOT NULL REFERENCES bills(id),
  service_id  uuid REFERENCES services(id), -- null for free-text lines
  description text NOT NULL,                  -- snapshot of service name / free text
  quantity    integer NOT NULL DEFAULT 1,
  unit_price  integer NOT NULL,               -- snapshot, minor units
  line_total  integer NOT NULL
);
CREATE INDEX bill_items_bill_idx ON bill_items (bill_id);

CREATE TABLE payments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id     uuid NOT NULL REFERENCES bills(id),
  amount      integer NOT NULL, -- minor units
  method      text NOT NULL,    -- cash | card | bank | other
  received_by uuid NOT NULL REFERENCES users(id),
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_bill_idx ON payments (bill_id);

CREATE TABLE reports (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         uuid NOT NULL REFERENCES clinics(id),
  patient_id        uuid NOT NULL REFERENCES patients(id),
  template_id       uuid NOT NULL REFERENCES report_templates(id),
  report_number     integer NOT NULL, -- sequential per clinic, gap-free
  template_snapshot jsonb NOT NULL,    -- FROZEN schema at creation
  data              jsonb NOT NULL,
  status            text NOT NULL DEFAULT 'draft', -- draft | finalized | verified
  verified_by       uuid REFERENCES users(id),
  verified_at       timestamptz,
  pdf_url           text,
  created_by        uuid NOT NULL REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reports_clinic_number_key UNIQUE (clinic_id, report_number)
);
CREATE INDEX reports_clinic_idx ON reports (clinic_id);
CREATE INDEX reports_patient_idx ON reports (patient_id);

CREATE TABLE audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   uuid NOT NULL REFERENCES clinics(id),
  user_id     uuid NOT NULL REFERENCES users(id),
  action      text NOT NULL, -- e.g. "bill.create", "report.verify"
  entity_type text NOT NULL, -- bill | report | patient | template | ...
  entity_id   uuid NOT NULL,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_clinic_idx ON audit_logs (clinic_id);

--rollback DROP TABLE IF EXISTS audit_logs;
--rollback DROP TABLE IF EXISTS reports;
--rollback DROP TABLE IF EXISTS payments;
--rollback DROP TABLE IF EXISTS bill_items;
--rollback DROP TABLE IF EXISTS bills;
--rollback DROP TABLE IF EXISTS report_templates;
--rollback DROP TABLE IF EXISTS services;
--rollback DROP TABLE IF EXISTS patients;
--rollback DROP TABLE IF EXISTS users;
--rollback DROP TABLE IF EXISTS clinics;
