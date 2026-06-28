--liquibase formatted sql

--changeset suwa:002-clinic-show-report-qr
--comment: Per-clinic toggle for the QR code on report PDFs (defaults on). Encodes the report
-- number so a printed report can be looked up by scan; an owner can turn it off in settings.

ALTER TABLE clinics ADD COLUMN show_report_qr boolean NOT NULL DEFAULT true;

--rollback ALTER TABLE clinics DROP COLUMN show_report_qr;
