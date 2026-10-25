--liquibase formatted sql

--changeset suwa:006-login-attempts
--comment: Sign-in attempts for rate limiting (per email and per client IP). Failed attempts for unknown emails are recorded too, which the audit log can't hold (it needs a user). Rows older than a day are deleted opportunistically by the app.

CREATE TABLE login_attempts (
  id          bigserial    PRIMARY KEY,
  email       text         NOT NULL,
  ip          text         NOT NULL,
  succeeded   boolean      NOT NULL,
  created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX login_attempts_email_idx ON login_attempts (email, created_at);
CREATE INDEX login_attempts_ip_idx ON login_attempts (ip, created_at);

--rollback DROP TABLE IF EXISTS login_attempts;
