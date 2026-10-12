BEGIN;
-- La cookie contiene un secreto aleatorio; solo su hash se guarda en Postgres.
ALTER TABLE sessions ADD COLUMN token_hash TEXT UNIQUE;
ALTER TABLE sessions ADD COLUMN operation_id UUID;
ALTER TABLE sessions ADD COLUMN operation_expires_at TIMESTAMPTZ;
ALTER TABLE sessions ADD COLUMN retired BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE sessions ADD CONSTRAINT session_lease_pair CHECK (
    (operation_id IS NULL) = (operation_expires_at IS NULL)
);
COMMIT;
