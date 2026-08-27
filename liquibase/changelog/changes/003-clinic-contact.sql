--liquibase formatted sql

--changeset suwa:003-clinic-contact
--comment: Fax + email for the clinic, shown in the report PDF house-style header (Tel/Fax/Email).

ALTER TABLE clinics ADD COLUMN fax text;
ALTER TABLE clinics ADD COLUMN email text;

--rollback ALTER TABLE clinics DROP COLUMN fax;
--rollback ALTER TABLE clinics DROP COLUMN email;
