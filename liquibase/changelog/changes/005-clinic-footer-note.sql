--liquibase formatted sql

--changeset suwa:005-clinic-footer-note
--comment: The clinic's own footer line printed on every report, bill, receipt and revenue PDF (e.g. "Our Facilities : Laboratory, ECG, …"), in place of the app's branding.

ALTER TABLE clinics ADD COLUMN footer_note text;

--rollback ALTER TABLE clinics DROP COLUMN footer_note;
