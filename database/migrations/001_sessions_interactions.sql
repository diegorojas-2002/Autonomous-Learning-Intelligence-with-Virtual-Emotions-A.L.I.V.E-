-- Ejecutar una vez sobre una base nueva. No guarda conversaciones.
BEGIN;
CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    state JSONB NOT NULL CHECK (jsonb_typeof(state) = 'object'),
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE interactions (
    operation_id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES sessions(id),
    thought_trace TEXT NOT NULL,
    state JSONB NOT NULL CHECK (jsonb_typeof(state) = 'object'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX interactions_session_created_idx
    ON interactions (session_id, created_at);
COMMIT;
