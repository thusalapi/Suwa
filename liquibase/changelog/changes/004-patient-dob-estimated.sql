--liquibase formatted sql

--changeset suwa:004-patient-dob-estimated
--comment: Staff may record a patient's age instead of a date of birth. The age is stored as an estimated dob (today minus the age) so it stays correct over time; this flag marks it as an estimate so it is never shown as a real birth date.

ALTER TABLE patients ADD COLUMN dob_estimated boolean NOT NULL DEFAULT false;

--rollback ALTER TABLE patients DROP COLUMN dob_estimated;
