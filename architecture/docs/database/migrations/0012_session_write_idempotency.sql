-- ============================================================
-- Migration: 0012_session_write_idempotency.sql
--
-- Purpose:
-- Document the schema artifact that backs idempotent batch writes.
--
-- This file is a documentation/spec artifact for the current workstream.
-- It must not be executed as part of documentation-only changes.
--
-- ============================================================
BEGIN;

-- ============================================================
-- session_write_idempotency
--
-- Stores persisted outcomes for POST /api/sessions/:sessionId/events:batch
-- requests keyed by idempotency.
--
-- ============================================================
CREATE TABLE session_write_idempotency (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL,
    idempotency_key TEXT NOT NULL,
    normalized_payload_hash TEXT NOT NULL,
    result JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_session_write_idempotency_session
        FOREIGN KEY (session_id)
        REFERENCES exercise_sessions(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_session_write_idempotency_session_key
        UNIQUE (session_id, idempotency_key),

    CONSTRAINT chk_session_write_idempotency_result_is_object
        CHECK (jsonb_typeof(result) = 'object'
        )
);

COMMENT ON TABLE session_write_idempotency IS
    'Stores batch-write idempotency results for POST /api/sessions/:sessionId/events:batch.';

COMMIT;

