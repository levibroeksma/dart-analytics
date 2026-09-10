-- ============================================================
-- Migration: 0030_activity_configurations.sql
--
-- Purpose:
-- Record which routine a training actually ran.
--
-- This is the Resolved Training Configuration of
-- 09-training-routines.md 18: the routine name plus its ordered,
-- resolved step list, snapshotted at Training start.
--
-- A snapshot, not a foreign key, because no runtime table may
-- reference a template (06-Spec/02-Template-Layer.md). Editing
-- or deleting a routine can never alter historical training.
--
-- Mirrors exercise_configurations one level up.
-- ============================================================

-- migrate:up
CREATE TABLE activity_configurations (
    id UUID PRIMARY KEY,
    activity_id UUID NOT NULL,
    configuration JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_activity_configurations_activity UNIQUE (activity_id),
    CONSTRAINT fk_activity_configurations_activity FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
);

COMMENT ON TABLE activity_configurations IS 'Immutable snapshot of the resolved routine a training executed.';

-- migrate:down
DROP TABLE IF EXISTS activity_configurations;
